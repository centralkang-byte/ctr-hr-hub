'use client'

import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSkeleton'

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
import { toast } from '@/hooks/use-toast'

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
  PENDING: 'bg-[#FFF3E0] text-[#FF9800]',
  APPROVED: 'bg-[#E8F5E9] text-[#2E7D32]',
  REJECTED: 'bg-[#FFEBEE] text-[#F44336]',
  CANCELLED: 'bg-[#F5F5F5] text-[#666]',
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
  const watchedPolicyId = watch('policyId')

  // ─── Balance preview calculation ───
  const selectedBalance = balances.find((b) => b.policy.id === watchedPolicyId) ?? null
  const selectedRemaining = selectedBalance
    ? Number(selectedBalance.grantedDays) +
      Number(selectedBalance.carryOverDays) -
      Number(selectedBalance.usedDays) -
      Number(selectedBalance.pendingDays)
    : null
  const requestedDaysNum = Number(watchedDays) || 0
  const projectedRemaining =
    selectedRemaining !== null ? selectedRemaining - requestedDaysNum : null

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
      toast({ title: '휴가 신청이 완료되었습니다', description: '담당자 승인 후 확정됩니다.' })
      void fetchBalances()
      void fetchRequests()
    } catch (err) {
      const msg = err instanceof Error ? err.message : '휴가 신청 중 오류가 발생했습니다.'
      toast({ title: '신청 실패', description: msg, variant: 'destructive' })
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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] text-xs font-semibold ${statusBadgeClass[row.status] ?? 'bg-[#F5F5F5] text-[#666]'}`}>
          {statusLabel[row.status] ?? row.status}
        </span>
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
      <div className="flex gap-6 overflow-x-auto pb-2">
        {balances.map((b) => {
          const remaining = getRemainingDays(b)
          const total = b.grantedDays + b.carryOverDays
          const usagePct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0
          return (
            <div
              key={b.id}
              className="min-w-[220px] flex-shrink-0 bg-white border border-[#E8E8E8] rounded-xl p-6"
            >
              <p className="text-xs text-[#999] font-medium mb-2">
                {b.policy.name}
              </p>
              <div className="flex items-end gap-1">
                <p className={`text-3xl font-bold tracking-[-0.02em] ${remaining > 0 ? 'text-[#00C853]' : 'text-[#999]'}`}>
                  {remaining}
                </p>
                <p className="text-sm text-[#999] mb-1">/ {total}{t('fullDay')}</p>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-2 rounded-full bg-[#E8E8E8] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00C853] to-[#00BFA5]"
                  style={{ width: `${Math.min(usagePct, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#999]">
                {t('usedDays')} {b.usedDays}{t('fullDay')} / {t('pendingDays')} {b.pendingDays}{t('fullDay')}
              </p>
            </div>
          )
        })}
        {balances.length === 0 && !loading && (
          <p className="py-4 text-sm text-[#999]">{tc('noData')}</p>
        )}
      </div>

      {/* ─── Section 3: Status filter + Request History ─── */}
      <div className="flex items-center gap-2">
        {[
          { value: 'ALL', label: tc('all') },
          { value: 'PENDING', label: t('pending') },
          { value: 'APPROVED', label: t('approved') },
          { value: 'REJECTED', label: t('rejected') },
          { value: 'CANCELLED', label: t('cancelled') },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === f.value
                ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                : 'bg-white text-[#666] border-[#E0E0E0] hover:bg-[#F5F5F5]'
            }`}
          >
            {f.label}
          </button>
        ))}
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

            {/* ─── Balance preview ─── */}
            {selectedBalance && selectedRemaining !== null && (
              <div className="rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#666]">
                    현재 잔여:{' '}
                    <strong className="text-[#1A1A1A]">{selectedRemaining}{t('fullDay')}</strong>
                  </span>
                  {requestedDaysNum > 0 && projectedRemaining !== null && (
                    <span
                      className={`text-sm font-semibold ${
                        projectedRemaining < 0
                          ? 'text-[#EF4444]'
                          : projectedRemaining <= 3
                          ? 'text-[#F59E0B]'
                          : 'text-[#00C853]'
                      }`}
                    >
                      신청: {requestedDaysNum}{t('fullDay')} | 잔여: {projectedRemaining}{t('fullDay')}
                    </span>
                  )}
                </div>
                {projectedRemaining !== null && projectedRemaining < 0 && (
                  <p className="mt-1 text-xs text-[#EF4444]">잔여 휴가가 부족합니다.</p>
                )}
              </div>
            )}

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
              <Button
                type="submit"
                disabled={saving || (projectedRemaining !== null && projectedRemaining < 0)}
              >
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
