'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Detail Client
// Off-Cycle 보상 요청 상세/승인 화면
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit3, Send, XCircle, CheckCircle2, RotateCcw, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { TableSkeleton } from '@/components/shared/PageSkeleton'
import OffCycleStatusBadge from '@/components/compensation/OffCycleStatusBadge'
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
  roleName: string
  approverName?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  comment?: string
  decidedAt?: string
}

interface OffCycleDetail {
  id: string
  employeeId: string
  employeeName: string
  department: string
  jobGrade: string
  reasonCategory: ReasonCategory
  currentSalary: number
  proposedSalary: number
  changePct: number
  effectiveDate: string
  justification: string
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
  rejectionComment?: string
  triggerSource?: string
}

interface Props {
  user: SessionUser
  requestId: string
}

// ─── Constants ──────────────────────────────────────────────

const REASON_LABEL: Record<ReasonCategory, string> = {
  PROMOTION: '승진', // TODO: i18n
  RETENTION: '리텐션', // TODO: i18n
  EQUITY_ADJUSTMENT: '형평성 조정', // TODO: i18n
  ROLE_CHANGE: '역할 변경', // TODO: i18n
  MARKET_ADJUSTMENT: '시장 조정', // TODO: i18n
  PERFORMANCE: '성과 기반', // TODO: i18n
}

// ─── Helpers ────────────────────────────────────────────────

function computeCompaRatio(salary: number, midSalary: number): number {
  if (midSalary <= 0) return 0
  return (salary / midSalary) * 100
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ─── Component ──────────────────────────────────────────────

export default function OffCycleDetailClient({ user, requestId }: Props) {
  const router = useRouter()

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
        title: '데이터 로드 실패', // TODO: i18n
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  // ─── Actions ───
  const handleAction = async (action: 'submit' | 'approve' | 'reject' | 'cancel' | 'revise') => {
    if (!detail) return

    try {
      setActionLoading(true)
      const body: Record<string, unknown> = { action }
      if (action === 'reject' && rejectComment.trim()) {
        body.comment = rejectComment.trim()
      }

      await apiClient.post(`/api/v1/compensation/off-cycle/${requestId}/action`, body)

      const messages: Record<string, string> = {
        submit: '승인 요청 완료', // TODO: i18n
        approve: '승인 완료', // TODO: i18n
        reject: '반려 처리 완료', // TODO: i18n
        cancel: '취소 완료', // TODO: i18n
        revise: '수정 모드로 전환', // TODO: i18n
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
        title: '처리 실패', // TODO: i18n
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // ─── Role-based visibility ───
  const isOwner = detail?.initiatorId === user.id
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
        <p className="text-muted-foreground">요청을 찾을 수 없습니다.</p> {/* TODO: i18n */}
      </div>
    )
  }

  const band = detail.salaryBand
  const currentCompaRatio = band ? computeCompaRatio(detail.currentSalary, band.midSalary) : null
  const proposedCompaRatio = band ? computeCompaRatio(detail.proposedSalary, band.midSalary) : null

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
              보상 / Off-Cycle 조정 / 상세 {/* TODO: i18n */}
            </nav>
            <h1 className="text-2xl font-bold text-foreground">
              Off-Cycle 보상 요청 {/* TODO: i18n */}
            </h1>
          </div>
        </div>
        <OffCycleStatusBadge status={detail.status} className="text-sm px-3 py-1" />
      </div>

      {/* ─── 트리거 정보 ─── */}
      {detail.triggerSource && (
        <div className="flex items-center gap-2 rounded-2xl bg-[#EEF2FF] p-4">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm text-foreground">
            자동 트리거: {detail.triggerSource} {/* TODO: i18n */}
          </span>
        </div>
      )}

      {/* ─── 직원 정보 카드 ─── */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          대상 직원 {/* TODO: i18n */}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">이름</p> {/* TODO: i18n */}
            <p className="font-medium text-foreground">{detail.employeeName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">부서</p> {/* TODO: i18n */}
            <p className="font-medium text-foreground">{detail.department}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">직급</p> {/* TODO: i18n */}
            <p className="font-medium text-foreground">{detail.jobGrade}</p>
          </div>
        </div>
      </div>

      {/* ─── 보상 정보 카드 ─── */}
      <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          보상 정보 {/* TODO: i18n */}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">현재 급여</p> {/* TODO: i18n */}
            <p className="font-mono tabular-nums font-semibold text-foreground">
              {formatCurrency(detail.currentSalary)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">제안 급여</p> {/* TODO: i18n */}
            <p className="font-mono tabular-nums font-semibold text-foreground">
              {formatCurrency(detail.proposedSalary)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">변동률</p> {/* TODO: i18n */}
            <p className={cn(
              'font-mono tabular-nums font-semibold',
              detail.changePct > 0 ? 'text-[#059669]' : detail.changePct < 0 ? 'text-[#DC2626]' : 'text-muted-foreground',
            )}>
              {detail.changePct >= 0 ? '+' : ''}{detail.changePct.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">시행일</p> {/* TODO: i18n */}
            <p className="font-mono tabular-nums font-medium text-foreground">
              {formatDate(detail.effectiveDate)}
            </p>
          </div>
        </div>

        {/* Compa-ratio 비교 */}
        {currentCompaRatio !== null && proposedCompaRatio !== null && (
          <div className="flex items-center gap-6 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">현재 Compa-Ratio</p> {/* TODO: i18n */}
              <p className="font-mono tabular-nums font-semibold text-foreground">
                {currentCompaRatio.toFixed(1)}%
              </p>
            </div>
            <span className="text-muted-foreground">→</span>
            <div>
              <p className="text-xs text-muted-foreground">제안 Compa-Ratio</p> {/* TODO: i18n */}
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
            currentSalary={detail.currentSalary}
            minSalary={band.minSalary}
            midSalary={band.midSalary}
            maxSalary={band.maxSalary}
            comparisonSalary={detail.proposedSalary}
          />
        )}

        {/* 사유 */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">사유 카테고리:</p> {/* TODO: i18n */}
            <span className="inline-flex items-center rounded-full bg-surface-container-low px-2.5 py-0.5 text-xs font-medium text-foreground">
              {REASON_LABEL[detail.reasonCategory] ?? detail.reasonCategory}
            </span>
          </div>
          {detail.justification && (
            <div className="rounded-2xl bg-surface-container-low p-4 text-sm text-foreground">
              {detail.justification}
            </div>
          )}
        </div>
      </div>

      {/* ─── 반려 사유 ─── */}
      {detail.rejectionComment && detail.status === 'REJECTED' && (
        <div className="rounded-2xl bg-[#FEF2F2] p-4 space-y-1">
          <p className="text-sm font-medium text-[#DC2626]">반려 사유</p> {/* TODO: i18n */}
          <p className="text-sm text-foreground">{detail.rejectionComment}</p>
        </div>
      )}

      {/* ─── 승인 타임라인 ─── */}
      {detail.approvalSteps.length > 0 && (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            승인 워크플로우 {/* TODO: i18n */}
          </h2>
          <OffCycleApprovalTimeline steps={detail.approvalSteps} />
        </div>
      )}

      {/* ─── 반려 입력 폼 ─── */}
      {showRejectForm && (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            반려 사유 입력 {/* TODO: i18n */}
          </h2>
          <Textarea
            placeholder="반려 사유를 입력해 주세요..." // TODO: i18n
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
              취소 {/* TODO: i18n */}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction('reject')}
              disabled={actionLoading || !rejectComment.trim()}
              className="rounded-xl"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              반려 확인 {/* TODO: i18n */}
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
              취소 {/* TODO: i18n */}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/compensation/off-cycle/new?employeeId=${detail.employeeId}&reason=${detail.reasonCategory}`)}
              disabled={actionLoading}
              className="rounded-xl"
            >
              <Edit3 className="mr-1.5 h-4 w-4" />
              수정 {/* TODO: i18n */}
            </Button>
            <Button
              onClick={() => handleAction('submit')}
              disabled={actionLoading}
              className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
              size="lg"
            >
              <Send className="mr-1.5 h-4 w-4" />
              승인 요청 {/* TODO: i18n */}
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
              className="rounded-xl text-[#DC2626] border-[#DC2626]/30 hover:bg-[#FEF2F2]"
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              반려 {/* TODO: i18n */}
            </Button>
            <Button
              onClick={() => handleAction('approve')}
              disabled={actionLoading}
              className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
              size="lg"
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              승인 {/* TODO: i18n */}
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
              취소 {/* TODO: i18n */}
            </Button>
            <Button
              onClick={() => handleAction('revise')}
              disabled={actionLoading}
              className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
              size="lg"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              수정 후 재요청 {/* TODO: i18n */}
            </Button>
          </>
        )}
      </div>

      {/* ─── 메타 정보 ─── */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        <span>요청자: {detail.initiatorName}</span> {/* TODO: i18n */}
        <span>생성일: {formatDate(detail.createdAt)}</span> {/* TODO: i18n */}
      </div>
    </div>
  )
}
