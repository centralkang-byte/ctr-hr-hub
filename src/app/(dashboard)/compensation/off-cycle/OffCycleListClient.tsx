'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation List Client
// Off-Cycle 보상 요청 목록 (상태 탭 + 필터 + 테이블)
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Plus, Filter, ArrowUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { TableSkeleton } from '@/components/shared/PageSkeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { apiClient } from '@/lib/api'
import { formatCurrency } from '@/lib/compensation'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'

// ─── Types ──────────────────────────────────────────────────

type OffCycleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
type ReasonCategory = 'PROMOTION' | 'RETENTION' | 'EQUITY_ADJUSTMENT' | 'ROLE_CHANGE' | 'MARKET_ADJUSTMENT' | 'PERFORMANCE'

interface OffCycleRequest {
  id: string
  employeeName: string
  reasonCategory: ReasonCategory
  currentBaseSalary: number
  proposedBaseSalary: number
  changePct: number
  status: OffCycleStatus
  initiatorName: string
  createdAt: string
}

type StatusTab = 'ALL' | OffCycleStatus

interface Props {
  user: SessionUser
}

// ─── Component ──────────────────────────────────────────────

export default function OffCycleListClient({ user }: Props) {
  const router = useRouter()
  const locale = useLocale()

  const [requests, setRequests] = useState<OffCycleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL')
  const [reasonFilter, setReasonFilter] = useState<ReasonCategory | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'createdAt' | 'changePct'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const canCreate = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user.role)

  const t = useTranslations('compensation')

  const STATUS_TABS: { value: StatusTab; label: string }[] = [
    { value: 'ALL', label: t('offCycle.all') },
    { value: 'DRAFT', label: t('offCycle.status.DRAFT') },
    { value: 'PENDING_APPROVAL', label: t('offCycle.status.PENDING_APPROVAL') },
    { value: 'APPROVED', label: t('offCycle.status.APPROVED') },
    { value: 'REJECTED', label: t('offCycle.status.REJECTED') },
  ]

  const REASON_OPTIONS: { value: ReasonCategory | 'ALL'; label: string }[] = [
    { value: 'ALL', label: t('offCycle.filterAllReasons') },
    { value: 'PROMOTION', label: t('offCycle.reason.PROMOTION') },
    { value: 'RETENTION', label: t('offCycle.reason.RETENTION') },
    { value: 'EQUITY_ADJUSTMENT', label: t('offCycle.reason.EQUITY_ADJUSTMENT') },
    { value: 'ROLE_CHANGE', label: t('offCycle.reason.ROLE_CHANGE') },
    { value: 'MARKET_ADJUSTMENT', label: t('offCycle.reason.MARKET_ADJUSTMENT') },
    { value: 'PERFORMANCE', label: t('offCycle.reason.PERFORMANCE') },
  ]

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string | number | undefined> = {
        limit: 50,
        sort: sortField,
        order: sortDir,
      }
      if (statusTab !== 'ALL') params.status = statusTab
      if (reasonFilter !== 'ALL') params.reasonCategory = reasonFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await apiClient.getList<OffCycleRequest>(
        '/api/v1/compensation/off-cycle',
        params,
      )
      setRequests(res.data)
    } catch (err) {
      toast({
        title: t('offCycle.toast.loadError'),
        description: err instanceof Error ? err.message : t('offCycle.toast.retryMessage'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [statusTab, reasonFilter, searchQuery, sortField, sortDir, t])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleSort = (field: 'createdAt' | 'changePct') => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const formatPct = (pct: number) => {
    const sign = pct >= 0 ? '+' : ''
    return `${sign}${pct.toFixed(1)}%`
  }

  return (
    <div className="p-6 space-y-6">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-xs text-muted-foreground mb-1">
            {t('offCycle.breadcrumb.list')}
          </nav>
          <h1 className="text-2xl font-bold text-foreground">
            {t('offCycle.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('offCycle.description')}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => router.push('/compensation/off-cycle/new')}
            className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
            size="lg"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('offCycle.newRequest')}
          </Button>
        )}
      </div>

      {/* ─── 상태 탭 ─── */}
      <Tabs
        value={statusTab}
        onValueChange={(val) => setStatusTab(val as StatusTab)}
      >
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ─── 필터 바 ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('offCycle.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-lg"
          />
        </div>
        <Select
          value={reasonFilter}
          onValueChange={(val) => setReasonFilter(val as ReasonCategory | 'ALL')}
        >
          <SelectTrigger className="w-[180px] rounded-lg">
            <Filter className="mr-1.5 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REASON_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── 테이블 ─── */}
      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : requests.length === 0 ? (
        <EmptyState
          title={t('offCycle.empty')}
          description={t('offCycle.emptyDescription')}
          action={
            canCreate
              ? {
                  label: t('offCycle.emptyAction'),
                  onClick: () => router.push('/compensation/off-cycle/new'),
                }
              : undefined
          }
        />
      ) : (
        <div className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container-high/50">
                <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('offCycle.table.employee')}
                </th>
                <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('offCycle.table.reason')}
                </th>
                <th className="text-right px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('offCycle.table.salary')}
                </th>
                <th
                  className="text-right px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground cursor-pointer select-none"
                  onClick={() => handleSort('changePct')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('offCycle.table.changePct')}
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="text-center px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('offCycle.table.status')}
                </th>
                <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t('offCycle.table.initiator')}
                </th>
                <th
                  className="text-right px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground cursor-pointer select-none"
                  onClick={() => handleSort('createdAt')}
                >
                  <span className="inline-flex items-center gap-1">
                    {t('offCycle.table.date')}
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr
                  key={req.id}
                  onClick={() => router.push(`/compensation/off-cycle/${req.id}`)}
                  className="cursor-pointer transition-colors hover:bg-surface-container-high/30"
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">{req.employeeName}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-full bg-surface-container-low px-2 py-0.5 text-xs font-medium text-foreground">
                      {t(`offCycle.reason.${req.reasonCategory}`)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-foreground">
                    <span className="text-muted-foreground">{formatCurrency(req.currentBaseSalary)}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className="font-medium">{formatCurrency(req.proposedBaseSalary)}</span>
                  </td>
                  <td className={cn(
                    'px-5 py-3 text-right font-mono tabular-nums font-medium',
                    req.changePct > 0 ? 'text-[#059669]' : req.changePct < 0 ? 'text-[#DC2626]' : 'text-muted-foreground',
                  )}>
                    {formatPct(req.changePct)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <StatusBadge status={req.status}>{t(`offCycle.status.${req.status}`)}</StatusBadge>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {req.initiatorName}
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-muted-foreground">
                    {formatDate(req.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
