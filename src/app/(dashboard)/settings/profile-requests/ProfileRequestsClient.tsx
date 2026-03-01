'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Profile Change Requests Admin (프로필 변경 요청 관리)
// HR 관리자: 대기 중 요청 목록 + 승인/반려
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('profileRequests')
  const tc = useTranslations('common')

  // ─── Translated label maps ───
  const FIELD_LABELS: Record<string, string> = {
    phone: t('phone'),
    emergencyContact: t('emergencyContact'),
    emergencyContactPhone: t('emergencyContactPhone'),
  }

  type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

  const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
    CHANGE_PENDING: { label: t('statusPending'), variant: 'outline' },
    CHANGE_APPROVED: { label: t('statusApproved'), variant: 'default' },
    CHANGE_REJECTED: { label: t('statusRejected'), variant: 'destructive' },
  }

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
      setRejectError(t('rejectReasonRequired'))
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
        err instanceof Error ? err.message : t('processingError'),
      )
    } finally {
      setProcessing(false)
    }
  }

  // ─── Table Columns ──────────────────────────────────────

  const columns: DataTableColumn<PendingRequest>[] = [
    {
      key: 'employeeName',
      header: t('employeeName'),
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
      header: t('fieldName'),
      render: (row) => FIELD_LABELS[row.fieldName] ?? row.fieldName,
    },
    {
      key: 'values',
      header: t('valuesChange'),
      render: (row) => (
        <span className="text-sm">
          {row.oldValue ?? t('noValue')}{' '}
          <span className="text-muted-foreground">→</span>{' '}
          <span className="font-medium">{row.newValue}</span>
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('requestDate'),
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: 'status',
      header: t('statusLabel'),
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
      header: t('actionLabel'),
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
              {t('approveBtn')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={processing}
              onClick={() => openRejectDialog(row)}
            >
              <X className="mr-1 h-3 w-3" />
              {t('rejectBtn')}
            </Button>
          </div>
        ) : null,
    },
  ]

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
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
            <DialogTitle>{t('rejectDialog')}</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <p>
                  <span className="text-muted-foreground">{t('employee')}:</span>{' '}
                  {rejectTarget.employee.name}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('fieldName')}:</span>{' '}
                  {FIELD_LABELS[rejectTarget.fieldName] ?? rejectTarget.fieldName}
                </p>
                <p>
                  <span className="text-muted-foreground">{t('changeContent')}:</span>{' '}
                  {rejectTarget.oldValue ?? t('noValue')} → {rejectTarget.newValue}
                </p>
              </div>
              <div>
                <Label>{t('rejectReason')}</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('rejectReasonPlaceholder')}
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
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? tc('loading') : t('rejectBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
