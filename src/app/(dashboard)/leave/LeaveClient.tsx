'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Leave Client
// 직원 휴가 관리 (잔여, 신청, 이력)
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// ─── Local interfaces ───────────────────────────────────────

interface LeaveBalanceLocal {
  id: string
  grantedDays: number
  usedDays: number
  pendingDays: number
  carryOverDays: number
  policy: { id: string; name: string; leaveType: string; isPaid: boolean }
}

interface LeaveRequestLocal {
  id: string
  startDate: string
  endDate: string
  days: number
  halfDayType: string | null
  reason: string
  status: string
  rejectionReason: string | null
  createdAt: string
  policy?: { name: string; leaveType: string }
}

interface LeavePolicyLocal {
  id: string
  name: string
  leaveType: string
}

// ─── Status badge styles ────────────────────────────────────

const statusBadgeClass: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

// ─── Component ──────────────────────────────────────────────

export function LeaveClient({ user }: { user: SessionUser }) {
  void user

  const t = useTranslations('leave')
  const tc = useTranslations('common')
  const te = useTranslations('employee')

  // ─── Form schema (needs t for validation messages) ───
  const requestSchema = z.object({
    policyId: z.string().min(1, t('selectLeaveType')),
    startDate: z.string().min(1, t('enterStartDate')),
    endDate: z.string().min(1, t('enterEndDate')),
    days: z.coerce.number().min(0.25).max(365),
    halfDayType: z.enum(['AM', 'PM']).optional(),
    reason: z.string().min(1, t('enterReason')).max(1000),
  })

  type RequestFormData = z.infer<typeof requestSchema>

  const statusLabel: Record<string, string> = {
    PENDING: t('pending'),
    APPROVED: t('approved'),
    REJECTED: t('rejected'),
    CANCELLED: t('cancelled'),
  }

  // ─── State ───
  const [balances, setBalances] = useState<LeaveBalanceLocal[]>([])
  const [requests, setRequests] = useState<LeaveRequestLocal[]>([])
  const [policies, setPolicies] = useState<LeavePolicyLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  // ─── Form ───
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof requestSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(requestSchema) as any,
    defaultValues: {
      policyId: '',
      startDate: '',
      endDate: '',
      days: 1,
      reason: '',
    },
  })

  const watchedDays = watch('days')

  // ─── Fetch balances ───
  const fetchBalances = useCallback(async () => {
    try {
      const res = await apiClient.get<LeaveBalanceLocal[]>('/api/v1/leave/balances')
      setBalances(res.data)
    } catch {
      setBalances([])
    }
  }, [])

  // ─── Fetch policies ───
  const fetchPolicies = useCallback(async () => {
    try {
      const res = await apiClient.getList<LeavePolicyLocal>('/api/v1/leave/policies', {
        limit: 100,
      })
      setPolicies(res.data)
    } catch {
      setPolicies([])
    }
  }, [])

  // ─── Fetch requests ───
  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit: 20,
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter
      }
      const res = await apiClient.getList<LeaveRequestLocal>('/api/v1/leave/requests', params)
      setRequests(res.data)
      setPagination(res.pagination)
    } catch {
      setRequests([])
      setPagination(undefined)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  // ─── Effects ───
  useEffect(() => {
    void fetchBalances()
    void fetchPolicies()
  }, [fetchBalances, fetchPolicies])

  useEffect(() => {
    void fetchRequests()
  }, [fetchRequests])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  // ─── Open request dialog ───
  const openRequestDialog = () => {
    reset({
      policyId: '',
      startDate: '',
      endDate: '',
      days: 1,
      reason: '',
    })
    setDialogOpen(true)
  }

  // ─── Submit request ───
  const onSubmit = async (data: RequestFormData) => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        policyId: data.policyId,
        startDate: data.startDate,
        endDate: data.endDate,
        days: data.days,
        reason: data.reason,
      }
      if (data.days === 0.5 && data.halfDayType) {
        payload.halfDayType = data.halfDayType
      }
      await apiClient.post('/api/v1/leave/requests', payload)
      setDialogOpen(false)
      void fetchBalances()
      void fetchRequests()
    } finally {
      setSaving(false)
    }
  }

  // ─── Cancel request ───
  const handleCancel = async (id: string) => {
    setCancellingId(id)
    try {
      await apiClient.put(`/api/v1/leave/requests/${id}/cancel`)
      void fetchBalances()
      void fetchRequests()
    } finally {
      setCancellingId(null)
    }
  }

  // ─── Balance remaining calculation ───
  const getRemainingDays = (b: LeaveBalanceLocal) =>
    b.grantedDays + b.carryOverDays - b.usedDays - b.pendingDays

  // ─── Date formatting ───
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('ko-KR')

  // ─── DataTable columns ───
  const columns: DataTableColumn<LeaveRequestLocal>[] = [
    {
      key: 'leaveType',
      header: t('policy'),
      render: (row: LeaveRequestLocal) => (
        <Badge variant="outline">{row.policy?.name ?? '-'}</Badge>
      ),
    },
    {
      key: 'startDate',
      header: t('startDate'),
      render: (row: LeaveRequestLocal) => formatDate(row.startDate),
    },
    {
      key: 'endDate',
      header: t('endDate'),
      render: (row: LeaveRequestLocal) => formatDate(row.endDate),
    },
    {
      key: 'days',
      header: t('days'),
      render: (row: LeaveRequestLocal) => `${row.days}${t('dayUnit')}`,
    },
    {
      key: 'status',
      header: te('status'),
      render: (row: LeaveRequestLocal) => (
        <Badge className={statusBadgeClass[row.status] ?? 'bg-gray-100 text-gray-800'}>
          {statusLabel[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: t('reason'),
      render: (row: LeaveRequestLocal) => (
        <span className="max-w-[200px] truncate block" title={row.reason}>
          {row.reason.length > 30 ? `${row.reason.slice(0, 30)}...` : row.reason}
        </span>
      ),
    },
    {
      key: 'actions',
      header: tc('actions'),
      render: (row: LeaveRequestLocal) => {
        if (row.status !== 'PENDING' && row.status !== 'APPROVED') return null
        return (
          <Button
            variant="outline"
            size="sm"
            disabled={cancellingId === row.id}
            onClick={() => handleCancel(row.id)}
          >
            {cancellingId === row.id && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            {tc('cancel')}
          </Button>
        )
      },
    },
  ]

  // ─── Render ───
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('balance')}
        actions={
          <Button onClick={openRequestDialog}>
            <Plus className="mr-1 h-4 w-4" />
            {t('request')}
          </Button>
        }
      />

      {/* ─── Section 1: Leave Balance Cards ─── */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {balances.map((b) => {
          const remaining = getRemainingDays(b)
          return (
            <Card
              key={b.id}
              className={`min-w-[200px] flex-shrink-0 ${
                remaining > 0 ? 'border-blue-200' : 'border-gray-200'
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {b.policy.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-3xl font-bold ${
                    remaining > 0 ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {remaining}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {t('fullDay')}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('grantedDays')} {b.grantedDays}{t('fullDay')} / {t('usedDays')}{' '}
                  {b.usedDays}{t('fullDay')} / {t('pendingDays')} {b.pendingDays}
                  {t('fullDay')}
                </p>
              </CardContent>
            </Card>
          )
        })}
        {balances.length === 0 && !loading && (
          <p className="py-4 text-sm text-muted-foreground">{tc('noData')}</p>
        )}
      </div>

      {/* ─── Section 3: Status filter + Request History ─── */}
      <div className="flex items-center gap-3">
        <Label>{tc('filter')}</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tc('all')}</SelectItem>
            <SelectItem value="PENDING">{t('pending')}</SelectItem>
            <SelectItem value="APPROVED">{t('approved')}</SelectItem>
            <SelectItem value="REJECTED">{t('rejected')}</SelectItem>
            <SelectItem value="CANCELLED">{t('cancelled')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns as unknown as DataTableColumn<Record<string, unknown>>[]}
        data={requests as unknown as Record<string, unknown>[]}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={tc('noData')}
        rowKey={(row) => (row as unknown as LeaveRequestLocal).id}
      />

      {/* ─── Section 2: Leave Request Dialog ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('request')}</DialogTitle>
            <DialogDescription>
              {t('requestDescription')}
            </DialogDescription>
          </DialogHeader>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
            {/* policyId */}
            <div className="space-y-2">
              <Label htmlFor="leave-policy">{t('policy')}</Label>
              <Controller
                control={control}
                name="policyId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="leave-policy">
                      <SelectValue placeholder={tc('selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {policies.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.policyId && (
                <p className="text-sm text-destructive">{errors.policyId.message}</p>
              )}
            </div>

            {/* startDate */}
            <div className="space-y-2">
              <Label htmlFor="leave-start">{t('startDate')}</Label>
              <Input id="leave-start" type="date" {...register('startDate')} />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>

            {/* endDate */}
            <div className="space-y-2">
              <Label htmlFor="leave-end">{t('endDate')}</Label>
              <Input id="leave-end" type="date" {...register('endDate')} />
              {errors.endDate && (
                <p className="text-sm text-destructive">{errors.endDate.message}</p>
              )}
            </div>

            {/* days */}
            <div className="space-y-2">
              <Label htmlFor="leave-days">{t('days')}</Label>
              <Input
                id="leave-days"
                type="number"
                step="0.5"
                min="0.25"
                {...register('days')}
              />
              {errors.days && (
                <p className="text-sm text-destructive">{errors.days.message}</p>
              )}
            </div>

            {/* halfDayType — only when days is 0.5 */}
            {watchedDays === 0.5 && (
              <div className="space-y-2">
                <Label htmlFor="leave-half">{t('halfDay')}</Label>
                <Controller
                  control={control}
                  name="halfDayType"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={(v) => field.onChange(v || undefined)}
                    >
                      <SelectTrigger id="leave-half">
                        <SelectValue placeholder={tc('selectPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">{t('halfDayAM')}</SelectItem>
                        <SelectItem value="PM">{t('halfDayPM')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            {/* reason */}
            <div className="space-y-2">
              <Label htmlFor="leave-reason">{t('reason')}</Label>
              <Textarea
                id="leave-reason"
                rows={3}
                maxLength={1000}
                placeholder={t('reasonPlaceholder')}
                {...register('reason')}
              />
              {errors.reason && (
                <p className="text-sm text-destructive">{errors.reason.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t('request')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
