'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Detail Client
// Off-Cycle 보상 요청 상세/승인 화면
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit3, Send, XCircle, CheckCircle2, RotateCcw, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { TableSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import OffCycleApprovalTimeline from '@/components/compensation/OffCycleApprovalTimeline'
import PayBandChart from '@/components/compensation/PayBandChart'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

type OffCycleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
type ReasonCategory = 'PROMOTION' | 'RETENTION' | 'EQUITY_ADJUSTMENT' | 'ROLE_CHANGE' | 'MARKET_ADJUSTMENT' | 'PERFORMANCE'

interface ApprovalStep {
  id: string
  stepNumber: number
  roleRequired: string
  approverName?: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  comment?: string | null
  decidedAt?: string | null
}

interface OffCycleDetail {
  id: string
  employeeId: string
  employeeName: string
  department: { id: string; name: string } | null
  jobGrade: { id: string; name: string } | null
  reasonCategory: ReasonCategory
  currentBaseSalary: number
  proposedBaseSalary: number
  changePct: number
  effectiveDate: string
  reason: string | null
  status: OffCycleStatus
  initiatorId: string
  initiatorName: string
  createdAt: string
  salaryBand?: {
    minSalary: number
    midSalary: number
    maxSalary: number
  }
  approvalSteps: ApprovalStep[]
  triggerEventType?: string | null
}

interface Props {
  user: SessionUser
  requestId: string
}

// ─── Helpers ────────────────────────────────────────────────

function computeCompaRatio(salary: number, midSalary: number): number {
  if (midSalary <= 0) return 0
  return (salary / midSalary) * 100
}

// ─── Component ──────────────────────────────────────────────

export default function OffCycleDetailClient({ user, requestId }: Props) {
  const router = useRouter()
  const t = useTranslations('compensation')
  const locale = useLocale()

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const [detail, setDetail] = useState<OffCycleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiClient.get<OffCycleDetail>(
        `/api/v1/compensation/off-cycle/${requestId}`,
      )
      setDetail(res.data)
    } catch (err) {
      toast({
        title: t('offCycle.toast.loadError'),
        description: err instanceof Error ? err.message : t('offCycle.toast.retryMessage'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [requestId, t])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  // ─── Actions ───
  const handleAction = async (action: 'submit' | 'approve' | 'reject' | 'cancel' | 'revise') => {
    if (!detail) return

    try {
      setActionLoading(true)
      const body: Record<string, unknown> = {}
      if (action === 'reject' && rejectComment.trim()) {
        body.comment = rejectComment.trim()
      }
      if (action === 'approve' && rejectComment.trim()) {
        body.comment = rejectComment.trim()
      }

      await apiClient.post(`/api/v1/compensation/off-cycle/${requestId}/${action}`, body)

      const messages: Record<string, string> = {
        submit: t('offCycle.toast.submitComplete'),
        approve: t('offCycle.toast.approveComplete'),
        reject: t('offCycle.toast.rejectComplete'),
        cancel: t('offCycle.toast.cancelComplete'),
        revise: t('offCycle.toast.reviseMode'),
      }
      toast({ title: messages[action] ?? '처리 완료' })

      if (action === 'revise') {
        router.push(`/compensation/off-cycle/new?employeeId=${detail.employeeId}&reason=${detail.reasonCategory}`)
      } else {
        fetchDetail()
      }
      setShowRejectForm(false)
      setRejectComment('')
    } catch (err) {
      toast({
        title: t('offCycle.toast.actionFailed'),
        description: err instanceof Error ? err.message : t('offCycle.toast.retryMessage'),
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Role-based visibility ───
  const isOwner = detail?.initiatorId === user.employeeId
  const isApprover = detail?.status === 'PENDING_APPROVAL' && (
    user.role === 'SUPER_ADMIN' ||
    user.role === 'HR_ADMIN' ||
    detail.approvalSteps.some(
      (s) => s.status === 'PENDING' && s.approverName === user.name,
    )
  )

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <TableSkeleton rows={4} cols={3} />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t('offCycle.detail.notFound')}</p>
      </div>
    )
  }

  const band = detail.salaryBand
  const currentCompaRatio = band ? computeCompaRatio(detail.currentBaseSalary, band.midSalary) : null
  const proposedCompaRatio = band ? computeCompaRatio(detail.proposedBaseSalary, band.midSalary) : null
  const rejectionComment = detail.approvalSteps.find((s) => s.status === 'REJECTED')?.comment

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/compensation/off-cycle')}
            className="rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <nav className="text-xs text-muted-foreground mb-1">
              {t('offCycle.breadcrumb.detail')}
            </nav>
            <h1 className="text-2xl font-bold text-foreground">
              {t('offCycle.title')}
            </h1>
          </div>
        </div>
        <StatusBadge status={detail.status} className="text-sm px-3 py-1">{t(`offCycle.status.${detail.status}`)}</StatusBadge>
      </div>

      {/* ─── 트리거 정보 ─── */}
      {detail.triggerEventType && (
        <div className="flex items-center gap-2 rounded-2xl bg-primary/10 p-4">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground">
            {t('offCycle.detail.trigger', { source: detail.triggerEventType })}
          </span>
        </div>
      )}

      {/* ─── 직원 정보 카드 ─── */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t('offCycle.section.employee')}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('offCycle.detail.name')}</p>
            <p className="font-medium text-foreground">{detail.employeeName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('offCycle.detail.department')}</p>
            <p className="font-medium text-foreground">{detail.department?.name ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('offCycle.detail.grade')}</p>
            <p className="font-medium text-foreground">{detail.jobGrade?.name ?? '-'}</p>
          </div>
        </div>
      </div>

      {/* ─── 보상 정보 카드 ─── */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t('offCycle.section.compensation')}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('offCycle.detail.currentSalary')}</p>
            <p className="font-mono tabular-nums font-semibold text-foreground">
              {formatCurrency(detail.currentBaseSalary)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('offCycle.detail.proposedSalary')}</p>
            <p className="font-mono tabular-nums font-semibold text-foreground">
              {formatCurrency(detail.proposedBaseSalary)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('offCycle.detail.changePct')}</p>
            <p className={cn(
              'font-mono tabular-nums font-semibold',
              detail.changePct > 0 ? 'text-[#059669]' : detail.changePct < 0 ? 'text-[#DC2626]' : 'text-muted-foreground',
            )}>
              {detail.changePct >= 0 ? '+' : ''}{detail.changePct.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('offCycle.detail.effectiveDate')}</p>
            <p className="font-mono tabular-nums font-medium text-foreground">
              {formatDate(detail.effectiveDate)}
            </p>
          </div>
        </div>

        {/* Compa-ratio 비교 */}
        {currentCompaRatio !== null && proposedCompaRatio !== null && (
          <div className="flex items-center gap-6 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">{t('offCycle.form.compaRatioBefore')}</p>
              <p className="font-mono tabular-nums font-semibold text-foreground">
                {currentCompaRatio.toFixed(1)}%
              </p>
            </div>
            <span className="text-muted-foreground">→</span>
            <div>
              <p className="text-xs text-muted-foreground">{t('offCycle.form.compaRatioAfter')}</p>
              <p className={cn(
                'font-mono tabular-nums font-semibold',
                proposedCompaRatio > 120 ? 'text-[#DC2626]' : 'text-foreground',
              )}>
                {proposedCompaRatio.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* PayBandChart */}
        {band && (
          <PayBandChart
            currentSalary={detail.currentBaseSalary}
            minSalary={band.minSalary}
            midSalary={band.midSalary}
            maxSalary={band.maxSalary}
            comparisonSalary={detail.proposedBaseSalary}
          />
        )}

        {/* 사유 */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{t('offCycle.detail.reasonCategory')}</p>
            <span className="inline-flex items-center rounded-full bg-surface-container-low px-2.5 py-0.5 text-xs font-medium text-foreground">
              {t(`offCycle.reason.${detail.reasonCategory}`)}
            </span>
          </div>
          {detail.reason && (
            <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-foreground">
              {detail.reason}
            </div>
          )}
        </div>
      </div>

      {/* ─── 반려 사유 ─── */}
      {rejectionComment && detail.status === 'REJECTED' && (
        <div className="rounded-2xl bg-destructive/10 p-4 space-y-1">
          <p className="text-sm font-medium text-destructive">{t('offCycle.rejectReason')}</p>
          <p className="text-sm text-foreground">{rejectionComment}</p>
        </div>
      )}

      {/* ─── 승인 타임라인 ─── */}
      {detail.approvalSteps.length > 0 && (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t('offCycle.section.approvalWorkflow')}
          </h2>
          <OffCycleApprovalTimeline steps={detail.approvalSteps} />
        </div>
      )}

      {/* ─── 반려 입력 폼 ─── */}
      {showRejectForm && (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t('offCycle.section.rejectForm')}
          </h2>
          <Textarea
            placeholder={t('offCycle.form.rejectPlaceholder')}
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={3}
            className="rounded-lg resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectForm(false)
                setRejectComment('')
              }}
              className="rounded-xl"
            >
              {t('offCycle.actions.cancelAction')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction('reject')}
              disabled={actionLoading || !rejectComment.trim()}
              className="rounded-xl"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              {t('offCycle.actions.confirmReject')}
            </Button>
          </div>
        </div>
      )}

      {/* ─── 액션 버튼 ─── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {/* DRAFT + owner: Edit / Submit / Cancel */}
        {detail.status === 'DRAFT' && isOwner && (
          <>
            <Button
              variant="outline"
              onClick={() => handleAction('cancel')}
              disabled={actionLoading}
              className="rounded-xl"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              {t('offCycle.actions.cancelAction')}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/compensation/off-cycle/new?employeeId=${detail.employeeId}&reason=${detail.reasonCategory}`)}
              disabled={actionLoading}
              className="rounded-xl"
            >
              <Edit3 className="mr-1.5 h-4 w-4" />
              {t('offCycle.actions.edit')}
            </Button>
            <Button
              onClick={() => handleAction('submit')}
              disabled={actionLoading}
              className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
              size="lg"
            >
              <Send className="mr-1.5 h-4 w-4" />
              {t('offCycle.actions.submit')}
            </Button>
          </>
        )}

        {/* PENDING_APPROVAL + approver: Approve / Reject */}
        {detail.status === 'PENDING_APPROVAL' && isApprover && !showRejectForm && (
          <>
            <Button
              variant="outline"
              onClick={() => setShowRejectForm(true)}
              disabled={actionLoading}
              className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              {t('offCycle.actions.reject')}
            </Button>
            <Button
              onClick={() => handleAction('approve')}
              disabled={actionLoading}
              className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
              size="lg"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {t('offCycle.actions.approve')}
            </Button>
          </>
        )}

        {/* REJECTED + owner: Revise / Cancel */}
        {detail.status === 'REJECTED' && isOwner && (
          <>
            <Button
              variant="outline"
              onClick={() => handleAction('cancel')}
              disabled={actionLoading}
              className="rounded-xl"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              {t('offCycle.actions.cancelAction')}
            </Button>
            <Button
              onClick={() => handleAction('revise')}
              disabled={actionLoading}
              className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
              size="lg"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {t('offCycle.actions.reviseResubmit')}
            </Button>
          </>
        )}
      </div>

      {/* ─── 메타 정보 ─── */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        <span>{t('offCycle.detail.initiator', { name: detail.initiatorName })}</span>
        <span>{t('offCycle.detail.createdAt', { date: formatDate(detail.createdAt) })}</span>
      </div>
    </div>
  )
}
