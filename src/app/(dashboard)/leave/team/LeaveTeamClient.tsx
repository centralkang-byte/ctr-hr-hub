'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Team Client
// 팀 휴가 캘린더: 팀원 휴가 현황, 승인/반려
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ko } from '@/lib/i18n/ko'
import type { SessionUser } from '@/types'

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
  PENDING: 'bg-ctr-warning text-white',
  APPROVED: 'bg-ctr-success text-white',
  REJECTED: 'bg-ctr-accent text-white',
  CANCELLED: 'bg-gray-400 text-white',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: ko.leave.pending,
  APPROVED: ko.leave.approved,
  REJECTED: ko.leave.rejected,
  CANCELLED: ko.leave.cancelled,
}

const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: ko.leave.annual,
  SICK: ko.leave.sick,
  MATERNITY: ko.leave.maternity,
  PATERNITY: ko.leave.paternity,
  BEREAVEMENT: ko.leave.bereavement,
  SPECIAL: ko.leave.special,
  COMPENSATORY: ko.leave.compensatory,
  FAMILY_CARE: ko.leave.familyCare,
  WEDDING: ko.leave.wedding,
  MENSTRUAL: ko.leave.menstrual,
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

// ─── Component ──────────────────────────────────────────────

export function LeaveTeamClient({ user }: { user: SessionUser }) {
  void user

  const [month, setMonth] = useState(getCurrentMonth)
  const [data, setData] = useState<TeamLeaveData | null>(null)
  const [loading, setLoading] = useState(true)

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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

  // ─── Actions ───
  const handleApprove = useCallback(
    async (requestId: string) => {
      setActionLoading(requestId)
      try {
        await apiClient.put(`/api/v1/leave/requests/${requestId}/approve`)
        await fetchData(month)
      } catch {
        // Error handled by apiClient
      } finally {
        setActionLoading(null)
      }
    },
    [month, fetchData],
  )

  const openRejectDialog = useCallback((requestId: string) => {
    setRejectTargetId(requestId)
    setRejectionReason('')
    setRejectDialogOpen(true)
  }, [])

  const handleReject = useCallback(async () => {
    if (!rejectTargetId) return
    setActionLoading(rejectTargetId)
    try {
      await apiClient.put(`/api/v1/leave/requests/${rejectTargetId}/reject`, {
        rejectionReason,
      })
      setRejectDialogOpen(false)
      setRejectTargetId(null)
      setRejectionReason('')
      await fetchData(month)
    } catch {
      // Error handled by apiClient
    } finally {
      setActionLoading(null)
    }
  }, [rejectTargetId, rejectionReason, month, fetchData])

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

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={ko.leave.teamCalendar}
        description={hasPending ? '승인 대기 요청이 있습니다' : undefined}
      />

      {/* ─── Month Selector ─── */}
      <div className="flex items-center gap-3">
        <Label htmlFor="month-selector" className="text-sm font-medium">
          월 선택
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
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {ko.common.noData}
          </CardContent>
        </Card>
      ) : (
        members.map((member) => (
          <Card key={member.employeeId}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{member.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {member.requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  이번 달 휴가 신청 없음
                </p>
              ) : (
                <div className="space-y-3">
                  {member.requests.map((req) => {
                    const isPending = req.status === 'PENDING'
                    const isLoading = actionLoading === req.id

                    return (
                      <div
                        key={req.id}
                        className={`flex items-center justify-between rounded-lg border p-3 ${
                          isPending
                            ? 'border-ctr-warning/40 bg-yellow-50'
                            : 'border-border'
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {formatDate(req.startDate)} ~{' '}
                              {formatDate(req.endDate)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {LEAVE_TYPE_LABEL[req.leaveType] ??
                                req.leaveType}
                            </Badge>
                            <Badge
                              className={`text-xs ${
                                STATUS_BADGE[req.status] ??
                                'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {STATUS_LABEL[req.status] ?? req.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {req.days}
                            {ko.leave.days}
                          </span>
                        </div>

                        {isPending && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-ctr-success text-ctr-success hover:bg-ctr-success hover:text-white"
                              onClick={() => handleApprove(req.id)}
                              disabled={isLoading}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              {ko.leave.approve}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-ctr-accent text-ctr-accent hover:bg-ctr-accent hover:text-white"
                              onClick={() => openRejectDialog(req.id)}
                              disabled={isLoading}
                            >
                              <X className="mr-1 h-4 w-4" />
                              {ko.leave.reject}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ko.leave.reject}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="rejection-reason">{ko.leave.rejectionReason}</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="반려 사유를 입력하세요"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
              {ko.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={
                !rejectionReason.trim() || actionLoading === rejectTargetId
              }
            >
              {actionLoading === rejectTargetId
                ? ko.common.loading
                : ko.leave.reject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
