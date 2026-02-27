'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Profile Change Requests Admin (프로필 변경 요청 관리)
// HR 관리자: 대기 중 요청 목록 + 승인/반려
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { apiClient } from '@/lib/api'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface PendingRequest {
  [key: string]: unknown
  id: string
  fieldName: string
  oldValue: string | null
  newValue: string
  status: string
  createdAt: string
  employee: { id: string; name: string; employeeNo: string }
}

interface ProfileRequestsClientProps {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  phone: '전화번호',
  emergencyContact: '비상연락처 이름',
  emergencyContactPhone: '비상연락처 전화',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  CHANGE_PENDING: { label: '대기', variant: 'outline' },
  CHANGE_APPROVED: { label: '승인', variant: 'default' },
  CHANGE_REJECTED: { label: '반려', variant: 'destructive' },
}

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ─── Component ──────────────────────────────────────────────

export function ProfileRequestsClient({ user: _user }: ProfileRequestsClientProps) {
  const [data, setData] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<PendingRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  // ─── Fetch ──────────────────────────────────────────────

  const fetchPending = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<PendingRequest[]>(
        '/api/v1/profile/change-requests/pending',
      )
      setData(res.data)
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  // ─── Approve ────────────────────────────────────────────

  async function handleApprove(row: PendingRequest) {
    if (processing) return
    setProcessing(true)
    try {
      await apiClient.put(`/api/v1/profile/change-requests/${row.id}/review`, {
        action: 'APPROVE',
      })
      await fetchPending()
    } catch {
      // silently handle
    } finally {
      setProcessing(false)
    }
  }

  // ─── Reject Dialog ──────────────────────────────────────

  function openRejectDialog(row: PendingRequest) {
    setRejectTarget(row)
    setRejectReason('')
    setRejectError('')
    setRejectDialogOpen(true)
  }

  async function handleReject() {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      setRejectError('반려 사유를 입력해주세요.')
      return
    }

    setProcessing(true)
    setRejectError('')
    try {
      await apiClient.put(
        `/api/v1/profile/change-requests/${rejectTarget.id}/review`,
        {
          action: 'REJECT',
          rejectionReason: rejectReason.trim(),
        },
      )
      setRejectDialogOpen(false)
      await fetchPending()
    } catch (err) {
      setRejectError(
        err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.',
      )
    } finally {
      setProcessing(false)
    }
  }

  // ─── Table Columns ──────────────────────────────────────

  const columns: DataTableColumn<PendingRequest>[] = [
    {
      key: 'employeeName',
      header: '직원명',
      render: (row) => (
        <span className="font-medium">
          {row.employee.name}{' '}
          <span className="text-xs text-muted-foreground">
            ({row.employee.employeeNo})
          </span>
        </span>
      ),
    },
    {
      key: 'fieldName',
      header: '필드',
      render: (row) => FIELD_LABELS[row.fieldName] ?? row.fieldName,
    },
    {
      key: 'values',
      header: '현재값 → 새값',
      render: (row) => (
        <span className="text-sm">
          {row.oldValue ?? '(없음)'}{' '}
          <span className="text-muted-foreground">→</span>{' '}
          <span className="font-medium">{row.newValue}</span>
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: '요청일',
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => {
        const st = STATUS_MAP[row.status] ?? {
          label: row.status,
          variant: 'outline' as BadgeVariant,
        }
        return <Badge variant={st.variant}>{st.label}</Badge>
      },
    },
    {
      key: 'actions',
      header: '액션',
      render: (row) =>
        row.status === 'CHANGE_PENDING' ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="default"
              disabled={processing}
              onClick={() => handleApprove(row)}
            >
              <Check className="mr-1 h-3 w-3" />
              승인
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={processing}
              onClick={() => openRejectDialog(row)}
            >
              <X className="mr-1 h-3 w-3" />
              반려
            </Button>
          </div>
        ) : null,
    },
  ]

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="프로필 변경 요청 관리"
        description="직원들의 프로필 수정 요청을 승인 또는 반려합니다."
      />

      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <DataTable columns={columns} data={data} />
      )}

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>변경 요청 반려</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <p>
                  <span className="text-muted-foreground">직원:</span>{' '}
                  {rejectTarget.employee.name}
                </p>
                <p>
                  <span className="text-muted-foreground">필드:</span>{' '}
                  {FIELD_LABELS[rejectTarget.fieldName] ?? rejectTarget.fieldName}
                </p>
                <p>
                  <span className="text-muted-foreground">변경 내용:</span>{' '}
                  {rejectTarget.oldValue ?? '(없음)'} → {rejectTarget.newValue}
                </p>
              </div>
              <div>
                <Label>반려 사유</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="반려 사유를 입력하세요"
                  className="mt-1"
                  rows={3}
                />
              </div>
              {rejectError && (
                <p className="text-sm text-destructive">{rejectError}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={processing}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? '처리 중...' : '반려'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
