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
import { toast } from '@/hooks/use-toast'

import type { SessionUser, PaginationInfo } from '@/types'
import { apiClient } from '@/lib/api'
import { PageHeader } from '@/components/shared/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ToastAction } from '@/components/ui/toast'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WdDrawer, WdField, WdNote } from '@/components/shared/WdDrawer'
import { WdLeaveBalanceCard } from '@/components/shared/WdLeaveBalanceCard'
import { WdUsageBarChart, type WdUsageBarDatum } from '@/components/shared/WdUsageBarChart'
import { EmptyState } from '@/components/ui/EmptyState'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { formatDateLocale } from '@/lib/format/date'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

// ─── Local interfaces ───────────────────────────────────────

interface LeaveBalanceLocal {
  id: string
  entitled: number
  used: number
  pending: number
  carriedOver: number
  adjusted: number
  remaining: number
  leaveTypeDefId: string
  leaveTypeDef: {
    id: string
    name: string
    nameEn: string | null
    code: string
    category: string | null
    isPaid: boolean
  }
  // legacy compat (policy field removed after Phase 6)
  grantedDays?: number
  usedDays?: number
  pendingDays?: number
  carryOverDays?: number
  policy?: { id: string; name: string; leaveType: string; isPaid: boolean }
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

// ─── Constants ──────────────────────────────────────────────
// WS-D(LV-005): raw statusBadgeClass 제거 → StatusBadge SSOT(status.ts
// STATUS_MAP: PENDING→warning/APPROVED→success/REJECTED→error/CANCELLED→neutral).

const SINGLE_DAY_PRESETS = new Set(['AM', 'PM', 'QUARTER'])

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
  const [usageData, setUsageData] = useState<WdUsageBarDatum[]>([])
  const [requests, setRequests] = useState<LeaveRequestLocal[]>([])
  const [policies, setPolicies] = useState<LeavePolicyLocal[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | undefined>()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [presetType, setPresetType] = useState<'FULL' | 'AM' | 'PM' | 'QUARTER' | 'CUSTOM'>('FULL')

  // ─── Form ───
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
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

  const watchedDays     = watch('days')
  const watchedPolicyId = watch('policyId')
  const watchedStart    = watch('startDate')
  const watchedEnd      = watch('endDate')

  // ─── Auto-calculate business days ───
  const calculateBusinessDays = (start: string, end: string): number => {
    const s = new Date(start)
    const e = new Date(end)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 1
    let count = 0
    const cur = new Date(s)
    while (cur <= e) {
      const day = cur.getDay()
      if (day !== 0 && day !== 6) count++
      cur.setDate(cur.getDate() + 1)
    }
    return Math.max(count, 1)
  }

  // Handle Preset Changes
  const handlePresetChange = (preset: 'FULL' | 'AM' | 'PM' | 'QUARTER' | 'CUSTOM') => {
    setPresetType(preset)

    if (SINGLE_DAY_PRESETS.has(preset)) {
      // AM/PM/QUARTER: force single day
      if (watchedStart) {
        setValue('endDate', watchedStart)
      }
      switch (preset) {
        case 'AM':
          setValue('days', 0.5)
          setValue('halfDayType', 'AM')
          break
        case 'PM':
          setValue('days', 0.5)
          setValue('halfDayType', 'PM')
          break
        case 'QUARTER':
          setValue('days', 0.25)
          setValue('halfDayType', undefined)
          break
      }
    } else if (preset === 'FULL') {
      // FULL: allow multi-day, auto-calculate
      setValue('halfDayType', undefined)
      if (watchedStart && watchedEnd && watchedStart !== watchedEnd) {
        setValue('days', calculateBusinessDays(watchedStart, watchedEnd))
      } else {
        setValue('days', 1)
      }
    } else {
      // CUSTOM: recalculate business days if we have both dates
      if (watchedStart && watchedEnd) {
        setValue('days', calculateBusinessDays(watchedStart, watchedEnd))
      }
      setValue('halfDayType', undefined)
    }
  }

  useEffect(() => {
    if (watchedStart && watchedEnd) {
      if (presetType === 'CUSTOM' || presetType === 'FULL') {
        const calc = calculateBusinessDays(watchedStart, watchedEnd)
        setValue('days', calc)
      } else if (watchedStart !== watchedEnd) {
        // Enforce start = end for single-day presets (AM/PM/QUARTER)
        setValue('endDate', watchedStart)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedStart, watchedEnd])

  // ─── Balance preview calculation ───
  const getRemainingDays = (b: LeaveBalanceLocal) =>
    b.remaining ?? (b.entitled + b.carriedOver + b.adjusted - b.used - b.pending)

  // policy의 leaveType → leaveTypeDef.code 매핑으로 balance를 찾음
  const LEAVE_TYPE_TO_CODE: Record<string, string> = {
    ANNUAL: 'annual', SICK: 'sick', MATERNITY: 'maternity',
    PATERNITY: 'paternity', BEREAVEMENT: 'bereavement',
    SPECIAL: 'special', COMPENSATORY: 'compensatory',
  }
  const selectedPolicy = policies.find(p => p.id === watchedPolicyId)
  const expectedCode = selectedPolicy ? LEAVE_TYPE_TO_CODE[selectedPolicy.leaveType] : null
  const selectedBalance = expectedCode
    ? balances.find((b) => b.leaveTypeDef?.code === expectedCode) ?? null
    : null
  const selectedRemaining = selectedBalance
    ? getRemainingDays(selectedBalance)
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
      
      // Deduplicate by name
      const uniquePolicies = res.data.reduce((acc, current) => {
        const x = acc.find((item) => item.name === current.name)
        if (!x) return acc.concat([current])
        return acc
      }, [] as LeavePolicyLocal[])

      // i18n: DB policy name matching — "특별휴가" is a DB value, not for translation
      const filteredPolicies = uniquePolicies.filter(p => !p.name.includes("특별휴가"))

      // i18n: DB policy name matching — sort annual-type policies to top
      const sortedPolicies = filteredPolicies.sort((a, b) => {
        const aIsAnnual = a.name.includes('연차')
        const bIsAnnual = b.name.includes('연차')
        if (aIsAnnual && !bIsAnnual) return -1
        if (!aIsAnnual && bIsAnnual) return 1
        return a.name.localeCompare(b.name)
      })

      setPolicies(sortedPolicies)
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
    } catch (err) {
      // WS-D: 무음 catch 제거 → toast(에러 사유) + 재시도 CTA. 빈 상태 노출(stale 방지)
      setRequests([])
      setPagination(undefined)
      toast({
        title: tc('loadFailed'),
        description: err instanceof Error ? err.message : t('submit.error'),
        variant: 'destructive',
        action: (
          <ToastAction altText={tc('retry')} onClick={() => { void fetchRequests() }}>
            {tc('retry')}
          </ToastAction>
        ),
      })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter])

  // ─── Fetch monthly usage (LV-002 — 전용 fetch, 페이지네이션 history 와 분리) ───
  // N4: /leave/requests limit cap 100, date param 없음. 개인 휴가 100행
  // (createdAt desc) ≫ 6개월 → 클라이언트 월별 집계. 백엔드 0 변경.
  const fetchUsage = useCallback(async () => {
    try {
      const res = await apiClient.getList<LeaveRequestLocal>('/api/v1/leave/requests', {
        limit: 100,
      })
      const now = new Date()
      const months = Array.from({ length: 6 }, (_, idx) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return { key, label: `${d.getMonth() + 1}월` }
      })
      // F3 (가디언 m0008): 프로토 byMonth.n = 신청 "건수" (days 합산 아님,
      // 1st principle 충실). REJECTED/CANCELLED 제외 = 승인/대기 = 사용한 휴가.
      const counts: Record<string, number> = {}
      for (const r of res.data) {
        if (r.status === 'REJECTED' || r.status === 'CANCELLED') continue
        const ym = (r.startDate ?? '').slice(0, 7) // 'YYYY-MM' (tz-safe)
        if (!ym) continue
        counts[ym] = (counts[ym] ?? 0) + 1
      }
      setUsageData(months.map((m) => ({ label: m.label, value: counts[m.key] ?? 0 })))
    } catch {
      setUsageData([])
    }
  }, [])

  // ─── Effects ───
  useEffect(() => {
    void fetchBalances()
    void fetchPolicies()
    void fetchUsage()
  }, [fetchBalances, fetchPolicies, fetchUsage])

  // Handle Preset Reset on Policy Change
  useEffect(() => {
    if (!watchedPolicyId || policies.length === 0) return
    const selected = policies.find(p => p.id === watchedPolicyId)
    if (selected) {
      // i18n: DB policy name matching — preset toggle only for annual leave
      if (!selected.name.includes('연차')) {
        setPresetType('CUSTOM')
      } else {
        // default back to FULL when an annual leave is selected
        setPresetType('FULL')
        setValue('halfDayType', undefined)
        // Recalculate if dates already set for multi-day
        if (watchedStart && watchedEnd && watchedStart !== watchedEnd) {
          setValue('days', calculateBusinessDays(watchedStart, watchedEnd))
        } else {
          setValue('days', 1)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedPolicyId, policies])

  useEffect(() => {
    void fetchRequests()
  }, [fetchRequests])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  // ─── Open request dialog ───
  const openRequestDialog = () => {
    setPresetType('FULL')
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
      toast({ title: tc('submitted'), description: t('submit.pendingApproval') })
      void fetchBalances()
      void fetchRequests()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('submit.error')
      toast({ title: tc('error'), description: msg, variant: 'destructive' })
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
    } catch (err) {
      // WS-D: 취소 실패 무음 제거 → toast(에러 사유)
      toast({
        title: tc('error'),
        description: err instanceof Error ? err.message : t('submit.error'),
        variant: 'destructive',
      })
    } finally {
      setCancellingId(null)
    }
  }

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
      render: (row: LeaveRequestLocal) => formatDateLocale(row.startDate),
    },
    {
      key: 'endDate',
      header: t('endDate'),
      render: (row: LeaveRequestLocal) => formatDateLocale(row.endDate),
    },
    {
      key: 'days',
      header: t('days'),
      render: (row: LeaveRequestLocal) => `${parseFloat(Number(row.days).toFixed(2))}${t('dayUnit')}`,
    },
    {
      key: 'status',
      header: te('status'),
      render: (row: LeaveRequestLocal) => (
        <StatusBadge status={row.status}>
          {statusLabel[row.status] ?? row.status}
        </StatusBadge>
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

      {/* ─── Section 1: Leave Balance Cards (PR-1 카나리 — WdGroupedStatCard SSOT) ─── */}
      <WdLeaveBalanceCard balances={balances} loading={loading} />

      {/* ─── Section 1b: 월별 사용 패턴 (PR-2 LV-002 카나리 — chart.ts SSOT) ─── */}
      <WdUsageBarChart
        title={t('monthlyUsagePattern')}
        data={usageData}
        unit="건"
        insight={null}
        emptyState={<EmptyState />}
      />

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
                ? 'bg-foreground text-white border-foreground'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        columns={columns as any as DataTableColumn<Record<string, unknown>>[]}
        data={requests as unknown as Record<string, unknown>[]}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage={tc('noData')}
        rowKey={(row) => (row as unknown as LeaveRequestLocal).id}
      />

      {/* ─── Section 2: Leave Request Form (WdDrawer 카나리) ─── */}
      {(() => {
        const formContent = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
            <WdNote>{t('requestDescription')}</WdNote>

            {/* policyId */}
            <WdField label={t('policy')}>
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
            </WdField>

            {/* ─── Balance preview ─── */}
            {selectedBalance && selectedRemaining !== null && (
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('balancePreview.currentRemaining')}{' '}
                    <strong className="text-foreground">{selectedRemaining}{t('fullDay')}</strong>
                  </span>
                  {requestedDaysNum > 0 && projectedRemaining !== null && (
                    <span
                      className={`text-sm font-semibold ${
                        projectedRemaining < 0
                          ? 'text-red-500'
                          : projectedRemaining <= 3
                          ? 'text-amber-500'
                          : 'text-primary'
                      }`}
                    >
                      {t('balancePreview.requestAmount', { amount: requestedDaysNum, unit: t('fullDay'), remaining: projectedRemaining })}
                    </span>
                  )}
                </div>
                {projectedRemaining !== null && projectedRemaining < 0 && (
                  <p className="mt-1 text-xs text-red-500">{t('balancePreview.insufficientWarning')}</p>
                )}
              </div>
            )}

            {/* ─── Preset Toggle ─── */}
            {/* i18n: DB policy name matching — preset toggle only for annual leave */}
            {policies.find(p => p.id === watchedPolicyId)?.name.includes('연차') && (
              <WdField label={t('balancePreview.selectType')}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'FULL', label: t('preset.annual') },
                    { id: 'AM', label: t('preset.halfDayAM') },
                    { id: 'PM', label: t('preset.halfDayPM') },
                    { id: 'QUARTER', label: t('preset.quarterDay') },
                    { id: 'CUSTOM', label: t('preset.custom') },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        preset.id as any
                      )}
                      className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                        presetType === preset.id
                          ? 'bg-foreground text-white border-foreground'
                          : 'bg-card text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </WdField>
            )}

            {/* startDate */}
            <WdField label={presetType === 'CUSTOM' || presetType === 'FULL' ? t('startDate') : t('balancePreview.leaveDate')}>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => (
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="leave-start"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal border-input bg-card",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? field.value : <span>{tc('selectPlaceholder')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const dateStr = format(date, "yyyy-MM-dd")
                            field.onChange(dateStr)
                            if (SINGLE_DAY_PRESETS.has(presetType)) {
                              setValue('endDate', dateStr)
                            }
                          } else {
                            field.onChange('')
                          }
                          setStartDateOpen(false)
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </WdField>

            {/* endDate - show for CUSTOM and FULL (multi-day) */}
            {(presetType === 'CUSTOM' || presetType === 'FULL') && (
              <WdField label={t('endDate')}>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="leave-end"
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal border-input bg-card",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? field.value : <span>{tc('selectPlaceholder')}</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100]" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => { field.onChange(date ? format(date, "yyyy-MM-dd") : ''); setEndDateOpen(false) }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.endDate && (
                  <p className="text-sm text-destructive">{errors.endDate.message}</p>
                )}
              </WdField>
            )}

            {/* days - show for CUSTOM (editable) and FULL (read-only, auto-calculated) */}
            {(presetType === 'CUSTOM' || presetType === 'FULL') && (
              <WdField label={t('days')}>
                <Input
                  id="leave-days"
                  type="number"
                  step="0.25"
                  min="0.25"
                  readOnly={presetType === 'FULL'}
                  {...register('days')}
                />
                {errors.days && (
                  <p className="text-sm text-destructive">{errors.days.message}</p>
                )}
              </WdField>
            )}

            {/* halfDayType — only show when Custom and days is 0.5. (Presets handle this implicitly via state) */}
            {presetType === 'CUSTOM' && watchedDays === 0.5 && (
              <WdField label={t('halfDay')}>
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
              </WdField>
            )}

            {/* reason */}
            <WdField label={t('reason')}>
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
            </WdField>
          </form>
        )

        return (
          <WdDrawer
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title={t('request')}
            secondary={{ label: tc('cancel'), onClick: () => setDialogOpen(false) }}
            primary={{
              label: t('request'),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick: () => { void handleSubmit(onSubmit as any)() },
              disabled: saving || (projectedRemaining !== null && projectedRemaining < 0),
              icon: saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined,
            }}
          >
            {formContent}
          </WdDrawer>
        )
      })()}
    </div>
  )
}
