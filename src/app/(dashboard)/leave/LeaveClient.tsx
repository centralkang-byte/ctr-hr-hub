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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
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

// ─── Status badge styles ────────────────────────────────────

const statusBadgeClass: Record<string, string> = {
  PENDING: 'bg-orange-500/10 text-orange-500',
  APPROVED: 'bg-primary/10 text-tertiary',
  REJECTED: 'bg-destructive/5 text-red-500',
  CANCELLED: 'bg-muted text-muted-foreground',
}

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

  const isMobile = useIsMobile()

  // ─── State ───
  const [balances, setBalances] = useState<LeaveBalanceLocal[]>([])
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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass[row.status] ?? 'bg-muted text-muted-foreground'}`}>
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

      {/* ─── Section 1: Leave Balance Cards (카테고리 그룹핑) ─── */}
      {!balances?.length && !loading && (
        <p className="py-4 text-sm text-muted-foreground">{tc('noData')}</p>
      )}
      {balances?.length > 0 && (() => {
        // 카테고리별 그룹핑
        const CATEGORY_ORDER = ['annual', 'sick', 'maternity', 'paternity', 'bereavement', 'special', 'compensatory', 'other']
        const CATEGORY_LABEL_KEYS: Record<string, string> = {
          annual: 'category.annual', sick: 'category.health', maternity: 'category.maternity',
          paternity: 'category.paternity', bereavement: 'category.familyEvent', special: 'category.special',
          compensatory: 'category.compensatory', other: 'category.other',
        }
        const groups: Record<string, LeaveBalanceLocal[]> = {}
        for (const b of balances) {
          const cat = b.leaveTypeDef?.code ?? 'other'
          if (!CATEGORY_LABEL_KEYS[cat]) {
            if (!groups['other']) groups['other'] = []
            groups['other'].push(b)
          } else {
            if (!groups[cat]) groups[cat] = []
            groups[cat].push(b)
          }
        }
        const orderedGroups = CATEGORY_ORDER.filter(c => groups[c]?.length)

        return (
          <div className="space-y-4">
            {orderedGroups.map(cat => (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  {CATEGORY_LABEL_KEYS[cat] ? t(CATEGORY_LABEL_KEYS[cat]) : cat}
                </p>
                <div className="flex gap-4 overflow-x-auto pb-1">
                  {groups[cat].map((b) => {
                    const remaining = getRemainingDays(b)
                    const total = b.entitled + b.carriedOver + b.adjusted
                    const usagePct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0
                    return (
                      <div
                        key={b.id}
                        className="min-w-[200px] flex-shrink-0 bg-card border border-border rounded-xl p-5"
                      >
                        <p className="text-xs text-muted-foreground font-medium mb-2">
                          {b.leaveTypeDef?.name ?? b.policy?.name ?? '-'}
                        </p>
                        <div className="flex items-end gap-1">
                          <p className={`text-2xl font-bold tracking-[-0.02em] ${remaining > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                            {remaining}
                          </p>
                          <p className="text-sm text-muted-foreground mb-0.5">/ {total} {t('fullDay')}</p>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#5E81F4] to-[#00BFA5]"
                            style={{ width: `${Math.min(usagePct, 100)}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t('usedDays')} {b.used}{t('fullDay')} / {t('pendingDays')} {b.pending}{t('fullDay')}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

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

      {/* ─── Section 2: Leave Request Form ─── */}
      {(() => {
        const formContent = (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
              <div className="space-y-2">
                <Label>{t('balancePreview.selectType')}</Label>
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
              </div>
            )}

            {/* startDate */}
            <div className="space-y-2">
              <Label htmlFor="leave-start">{presetType === 'CUSTOM' || presetType === 'FULL' ? t('startDate') : t('balancePreview.leaveDate')}</Label>
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
            </div>

            {/* endDate - show for CUSTOM and FULL (multi-day) */}
            {(presetType === 'CUSTOM' || presetType === 'FULL') && (
              <div className="space-y-2">
                <Label htmlFor="leave-end">{t('endDate')}</Label>
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
              </div>
            )}

            {/* days - show for CUSTOM (editable) and FULL (read-only, auto-calculated) */}
            {(presetType === 'CUSTOM' || presetType === 'FULL') && (
              <div className="space-y-2">
                <Label htmlFor="leave-days">{t('days')}</Label>
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
            </div>
            )}

            {/* halfDayType — only show when Custom and days is 0.5. (Presets handle this implicitly via state) */}
            {presetType === 'CUSTOM' && watchedDays === 0.5 && (
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

            <div className="flex justify-end gap-2 pt-4">
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
            </div>
          </form>
        )

        return isMobile ? (
          <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>{t('request')}</SheetTitle>
                <SheetDescription>{t('requestDescription')}</SheetDescription>
              </SheetHeader>
              {formContent}
            </SheetContent>
          </Sheet>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>{t('request')}</DialogTitle>
                <DialogDescription>{t('requestDescription')}</DialogDescription>
              </DialogHeader>
              {formContent}
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}
