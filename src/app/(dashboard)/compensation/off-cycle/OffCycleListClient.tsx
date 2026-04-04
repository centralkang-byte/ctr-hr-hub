'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Off-Cycle Compensation List Client
// Off-Cycle 보상 요청 목록 (상태 탭 + 필터 + 테이블)
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Filter, ArrowUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { TableSkeleton } from '@/components/shared/PageSkeleton'
import OffCycleStatusBadge from '@/components/compensation/OffCycleStatusBadge'
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
  department: string
  reasonCategory: ReasonCategory
  currentSalary: number
  proposedSalary: number
  changePct: number
  status: OffCycleStatus
  initiatorName: string
  createdAt: string
}

type StatusTab = 'ALL' | OffCycleStatus

interface Props {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'ALL', label: '전체' }, // TODO: i18n
  { value: 'DRAFT', label: '초안' }, // TODO: i18n
  { value: 'PENDING_APPROVAL', label: '승인 대기' }, // TODO: i18n
  { value: 'APPROVED', label: '승인' }, // TODO: i18n
  { value: 'REJECTED', label: '반려' }, // TODO: i18n
]

const REASON_OPTIONS: { value: ReasonCategory | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체 사유' }, // TODO: i18n
  { value: 'PROMOTION', label: '승진' }, // TODO: i18n
  { value: 'RETENTION', label: '리텐션' }, // TODO: i18n
  { value: 'EQUITY_ADJUSTMENT', label: '형평성 조정' }, // TODO: i18n
  { value: 'ROLE_CHANGE', label: '역할 변경' }, // TODO: i18n
  { value: 'MARKET_ADJUSTMENT', label: '시장 조정' }, // TODO: i18n
  { value: 'PERFORMANCE', label: '성과 기반' }, // TODO: i18n
]

const REASON_LABEL: Record<ReasonCategory, string> = {
  PROMOTION: '승진', // TODO: i18n
  RETENTION: '리텐션', // TODO: i18n
  EQUITY_ADJUSTMENT: '형평성 조정', // TODO: i18n
  ROLE_CHANGE: '역할 변경', // TODO: i18n
  MARKET_ADJUSTMENT: '시장 조정', // TODO: i18n
  PERFORMANCE: '성과 기반', // TODO: i18n
}

// ─── Component ──────────────────────────────────────────────

export default function OffCycleListClient({ user }: Props) {
  const router = useRouter()

  const [requests, setRequests] = useState<OffCycleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<StatusTab>('ALL')
  const [reasonFilter, setReasonFilter] = useState<ReasonCategory | 'ALL'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'createdAt' | 'changePct'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const canCreate = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'].includes(user.role)

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
        title: '목록 로드 실패', // TODO: i18n
        description: err instanceof Error ? err.message : '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [statusTab, reasonFilter, searchQuery, sortField, sortDir])

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
    return new Date(dateStr).toLocaleDateString('ko-KR', {
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
            보상 / Off-Cycle 조정 {/* TODO: i18n */}
          </nav>
          <h1 className="text-2xl font-bold text-foreground">
            Off-Cycle 보상 조정 {/* TODO: i18n */}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            정기 보상 외 개별 급여 조정 요청을 관리합니다. {/* TODO: i18n */}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => router.push('/compensation/off-cycle/new')}
            className="rounded-full bg-gradient-to-r from-primary to-primary-dim shadow-lg shadow-primary/20"
            size="lg"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            새 요청 {/* TODO: i18n */}
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
            placeholder="직원 이름 검색..." // TODO: i18n
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
          title="Off-Cycle 요청이 없습니다" // TODO: i18n
          description="조건에 맞는 요청이 없습니다. 필터를 변경하거나 새 요청을 생성하세요." // TODO: i18n
          action={
            canCreate
              ? {
                  label: '새 요청 생성', // TODO: i18n
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
                  직원 {/* TODO: i18n */}
                </th>
                <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  사유 {/* TODO: i18n */}
                </th>
                <th className="text-right px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  현재 → 제안 급여 {/* TODO: i18n */}
                </th>
                <th
                  className="text-right px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground cursor-pointer select-none"
                  onClick={() => handleSort('changePct')}
                >
                  <span className="inline-flex items-center gap-1">
                    변동% {/* TODO: i18n */}
                    <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="text-center px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  상태 {/* TODO: i18n */}
                </th>
                <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground">
                  요청자 {/* TODO: i18n */}
                </th>
                <th
                  className="text-right px-5 py-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground cursor-pointer select-none"
                  onClick={() => handleSort('createdAt')}
                >
                  <span className="inline-flex items-center gap-1">
                    날짜 {/* TODO: i18n */}
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
                    <div className="text-xs text-muted-foreground">{req.department}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center rounded-full bg-surface-container-low px-2 py-0.5 text-xs font-medium text-foreground">
                      {REASON_LABEL[req.reasonCategory] ?? req.reasonCategory}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono tabular-nums text-foreground">
                    <span className="text-muted-foreground">{formatCurrency(req.currentSalary)}</span>
                    <span className="mx-1 text-muted-foreground">→</span>
                    <span className="font-medium">{formatCurrency(req.proposedSalary)}</span>
                  </td>
                  <td className={cn(
                    'px-5 py-3 text-right font-mono tabular-nums font-medium',
                    req.changePct > 0 ? 'text-[#059669]' : req.changePct < 0 ? 'text-[#DC2626]' : 'text-muted-foreground',
                  )}>
                    {formatPct(req.changePct)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <OffCycleStatusBadge status={req.status} />
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
