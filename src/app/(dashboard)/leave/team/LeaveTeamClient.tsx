'use client'


// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Team Client
// 팀 휴가 캘린더: 팀원 휴가 현황, 승인/반려
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, X, CalendarOff } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { apiClient } from '@/lib/api'
import { EmptyState } from '@/components/ui/EmptyState'
import type { SessionUser } from '@/types'
import { ConfirmDialog, useConfirmDialog } from '@/components/ui/confirm-dialog'
import { STATUS_VARIANT } from '@/lib/styles/status'

// ─── Types ──────────────────────────────────────────────────

interface LeaveRequestItem {
  id: string
  startDate: string
  endDate: string
  days: number
  status: string
  leaveType: string
}

interface TeamMember {
  employeeId: string
  name: string
  requests: LeaveRequestItem[]
}

interface TeamLeaveData {
  month: string
  members: TeamMember[]
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING: STATUS_VARIANT.warning,
  APPROVED: STATUS_VARIANT.success,
  REJECTED: STATUS_VARIANT.error,
  CANCELLED: STATUS_VARIANT.neutral,
}

// ─── Helpers ────────────────────────────────────────────────

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  })
}

function getCurrentMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getTeamAbsenceCount(
  members: TeamMember[],
  excludeEmployeeId: string,
  startDate: string,
  endDate: string,
): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  let count = 0
  for (const member of members) {
    if (member.employeeId === excludeEmployeeId) continue
    for (const req of member.requests) {
      const reqStart = new Date(req.startDate)
      const reqEnd = new Date(req.endDate)
      if (reqStart <= end && reqEnd >= start) {
        count++
        break // count each member at most once
      }
    }
  }
  return count
}

// ─── Component ──────────────────────────────────────────────

export function LeaveTeamClient({ user }: { user: SessionUser }) {
  void user

  const t = useTranslations('leave')
  const tc = useTranslations('common')

  const STATUS_LABEL: Record<string, string> = {
    PENDING: '대기중',
    APPROVED: '승인되었습니다',
    REJECTED: '반려되었습니다',
    CANCELLED: '취소되었습니다',
  }

  const LEAVE_TYPE_LABEL: Record<string, string> = {
    ANNUAL: '연차',
    SICK: '병가',
    MATERNITY: '출산휴가',
    PATERNITY: '배우자출산휴가',
    BEREAVEMENT: '경조사',
    SPECIAL: '특별휴가',
    COMPENSATORY: '보상휴가',
    FAMILY_CARE: '가족돌봄휴가',
    WEDDING: '결혼휴가',
    MENSTRUAL: '생리휴가',
  }

  const [month, setMonth] = useState(getCurrentMonth)
  const [data, setData] = useState<TeamLeaveData | null>(null)
  const [loading, setLoading] = useState(true)
  const { confirm, dialogProps } = useConfirmDialog()

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Optimistic UI state
  const [optimisticMap, setOptimisticMap] = useState<Partial<Record<string, 'APPROVED' | 'REJECTED'>>>({})
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set())

  // ─── Fetch ───
  const fetchData = useCallback(async (m: string) => {
    setLoading(true)
    try {
      const res = await apiClient.get<TeamLeaveData>('/api/v1/leave/team', {
        month: m,
      })
      setData(res.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData(month)
  }, [month, fetchData])

  // ─── Helpers ───
  const scheduleRowFadeAndRefresh = useCallback(
    (requestId: string) => {
      setTimeout(() => setFadingIds((prev) => new Set(prev).add(requestId)), 1500)
      setTimeout(() => {
        void fetchData(month)
        setFadingIds((prev) => {
          const s = new Set(prev)
          s.delete(requestId)
          return s
        })
        setOptimisticMap((prev) => {
          const next = { ...prev }
          delete next[requestId]
          return next
        })
      }, 2000)
    },
    [month, fetchData],
  )

  const revertOptimistic = useCallback((requestId: string) => {
    setFadingIds((prev) => {
      const s = new Set(prev)
      s.delete(requestId)
      return s
    })
    setOptimisticMap((prev) => {
      const next = { ...prev }
      delete next[requestId]
      return next
    })
  }, [])

  // ─── Actions ───
  const handleApprove = useCallback(
    (requestId: string) => {
      confirm({
        title: '승인 확인',
        description: '이 휴가 요청을 승인하시겠습니까? 승인 후에는 취소할 수 없습니다.',
        confirmLabel: '승인',
        variant: 'default',
        onConfirm: async () => {
          // 1. Optimistic: immediately show green row
          setOptimisticMap((prev) => ({ ...prev, [requestId]: 'APPROVED' }))
          try {
            await apiClient.put(`/api/v1/leave/requests/${requestId}/approve`)
            // 2. Success: fade out after 1.5s
            scheduleRowFadeAndRefresh(requestId)
          } catch {
            revertOptimistic(requestId)
            toast({ title: tc('error'), description: '승인 처리 중 오류가 발생했습니다', variant: 'destructive' })
          }
        },
      })
    },
    [confirm, scheduleRowFadeAndRefresh, revertOptimistic, tc],
  )

  const openRejectDialog = useCallback((requestId: string) => {
    setRejectTargetId(requestId)
    setRejectionReason('')
    setRejectDialogOpen(true)
  }, [])

  const handleReject = useCallback(async () => {
    if (!rejectTargetId) return
    const requestId = rejectTargetId
    const reason = rejectionReason

    // 1. Close dialog + optimistic: immediately show red row
    setRejectDialogOpen(false)
    setRejectTargetId(null)
    setRejectionReason('')
    setOptimisticMap((prev) => ({ ...prev, [requestId]: 'REJECTED' }))

    try {
      await apiClient.put(`/api/v1/leave/requests/${requestId}/reject`, { rejectionReason: reason })
      // 2. Success: fade out after 1.5s
      scheduleRowFadeAndRefresh(requestId)
    } catch {
      revertOptimistic(requestId)
      toast({ title: tc('error'), description: '반려 처리 중 오류가 발생했습니다', variant: 'destructive' })
    }
  }, [rejectTargetId, rejectionReason, scheduleRowFadeAndRefresh, revertOptimistic])

  // ─── Loading skeleton ───
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const members = data?.members ?? []
  const hasPending = members.some((m) =>
    m.requests.some((r) => r.status === 'PENDING'),
  )
  const hasAnyRequests = members.some((m) => m.requests.length > 0)

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={'팀 휴가 캘린더'}
        description={hasPending ? '승인 대기 요청이 있습니다' : undefined}
      />

      {/* ─── Month Selector ─── */}
      <div className="flex items-center gap-3">
        <Label htmlFor="month-selector" className="text-sm font-medium">
          {tc('selectMonth')}
        </Label>
        <input
          id="month-selector"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* ─── Team Members ─── */}
      {members.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="팀원이 없습니다"
          description="팀원이 배정되면 여기에 휴가 현황이 표시됩니다."
        />
      ) : !hasAnyRequests ? (
        <div className="space-y-4">
          <EmptyState
            icon={CalendarOff}
            title="이번 달 팀 휴가 신청이 없습니다"
            description="팀원의 휴가 신청이 있으면 여기에 표시됩니다."
          />
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {members.map((member) => (
              <div key={member.employeeId} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-foreground">{member.name}</span>
                <span className="text-xs text-muted-foreground">휴가 없음</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        members.map((member) => (
          <div key={member.employeeId} className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-base font-bold text-foreground tracking-[-0.02em] mb-4">{member.name}</h3>
                <div className="space-y-3">
                  {member.requests.map((req) => {
                    const optimisticStatus = optimisticMap[req.id]
                    const isFading = fadingIds.has(req.id)
                    const displayStatus = optimisticStatus ?? req.status
                    const isPending = displayStatus === 'PENDING'
                    const absenceCount = getTeamAbsenceCount(
                      members,
                      member.employeeId,
                      req.startDate as string,
                      req.endDate as string,
                    )

                    const rowBorderBg = optimisticStatus === 'APPROVED'
                      ? 'border-emerald-200 bg-emerald-500/15/30'
                      : optimisticStatus === 'REJECTED'
                      ? 'border-destructive/20 bg-destructive/10/30'
                      : isPending
                      ? 'border-orange-200 bg-orange-500/10/30'
                      : 'border-border'

                    return (
                      <div
                        key={req.id}
                        className={`flex items-center justify-between rounded-lg border p-3 transition-opacity duration-500 ${rowBorderBg}`}
                        style={{ opacity: isFading ? 0 : 1 }}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {formatDate(req.startDate)} ~{' '}
                              {formatDate(req.endDate)}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs font-medium border border-border text-muted-foreground">
                              {LEAVE_TYPE_LABEL[req.leaveType] ?? req.leaveType}
                            </span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${
                                STATUS_BADGE[displayStatus] ?? STATUS_VARIANT.neutral
                              }`}
                            >
                              {STATUS_LABEL[displayStatus] ?? displayStatus}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {req.days}{'일수'}
                            </span>
                            {isPending && absenceCount > 0 && (
                              <span className="text-xs text-amber-500 font-medium">
                                해당 기간 팀 부재: {absenceCount}명
                              </span>
                            )}
                          </div>
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2">
                            <button
                              className="h-8 px-3 text-sm font-semibold rounded-lg border border-primary text-primary hover:bg-primary/10 flex items-center"
                              onClick={() => handleApprove(req.id)}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              {'승인'}
                            </button>
                            <button
                              className="h-8 px-3 text-sm font-semibold rounded-lg border border-red-500 text-red-500 hover:bg-destructive/5 flex items-center"
                              onClick={() => openRejectDialog(req.id)}
                            >
                              <X className="mr-1 h-4 w-4" />
                              {'반려'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
          </div>
        ))
      )}

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{'반려'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="rejection-reason">{'반려 사유'}</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={'반려 사유를 입력하세요'}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim()}
            >
              {'반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
