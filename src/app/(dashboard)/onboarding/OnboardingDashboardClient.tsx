'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Onboarding Dashboard Client
// 온보딩 현황: 진행률, 지연 여부, 강제 완료
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { apiClient } from '@/lib/api'
import { ROLE } from '@/lib/constants'
import type { SessionUser, PaginationInfo } from '@/types'

// ─── Types ──────────────────────────────────────────────────

interface OnboardingTask {
  id: string
  status: string
  task: { isRequired: boolean; dueDaysAfter: number }
}

interface OnboardingRow {
  id: string
  status: string
  startedAt: string | null
  employee: { id: string; name: string; hireDate: string | null; companyId: string }
  buddy: { id: string; name: string } | null
  template: { id: string; name: string }
  tasks: OnboardingTask[]
  progress: { total: number; completed: number }
  isDelayed: boolean
}

interface OnboardingDashboardClientProps {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  IN_PROGRESS: 'default',
  COMPLETED: 'secondary',
}

const FILTER_OPTIONS = [
  { value: '__ALL__', label: '전체' },
  { value: 'IN_PROGRESS', label: '진행 중' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'DELAYED', label: '지연' },
]

const LIMIT_OPTIONS = [10, 20, 50]

// ─── Component ──────────────────────────────────────────────

export function OnboardingDashboardClient({ user }: OnboardingDashboardClientProps) {
  // ─── State ───
  const [filter, setFilter] = useState('__ALL__')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [data, setData] = useState<OnboardingRow[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Force-complete dialog state
  const [forceTarget, setForceTarget] = useState<OnboardingRow | null>(null)
  const [forceReason, setForceReason] = useState('')
  const [forceLoading, setForceLoading] = useState(false)

  const isHrAdmin = user.role === ROLE.HR_ADMIN || user.role === ROLE.SUPER_ADMIN

  // ─── Fetch ───
  const fetchData = useCallback(() => {
    setLoading(true)
    const params: Record<string, string | number> = { page, limit }
    if (filter !== '__ALL__' && filter !== 'DELAYED') {
      params.status = filter
    }
    // DELAYED: fetch IN_PROGRESS and filter client-side
    if (filter === 'DELAYED') {
      params.status = 'IN_PROGRESS'
    }

    apiClient
      .getList<OnboardingRow>('/api/v1/onboarding/dashboard', params)
      .then((res) => {
        let rows = res.data
        if (filter === 'DELAYED') {
          rows = rows.filter((r) => r.isDelayed)
        }
        setData(rows)
        setPagination(res.pagination)
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [page, limit, filter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Force complete handler ───
  const handleForceComplete = useCallback(async () => {
    if (!forceTarget || !forceReason.trim()) return
    setForceLoading(true)
    try {
      await apiClient.put(`/api/v1/onboarding/${forceTarget.id}/force-complete`, {
        reason: forceReason.trim(),
      })
      setForceTarget(null)
      setForceReason('')
      fetchData()
    } catch {
      // Error handled by apiClient
    } finally {
      setForceLoading(false)
    }
  }, [forceTarget, forceReason, fetchData])

  // ─── Pagination ───
  const totalPages = pagination?.totalPages ?? 1

  // ─── Progress bar renderer ───
  const ProgressBar = useMemo(
    () =>
      function ProgressBarInner({
        completed,
        total,
      }: {
        completed: number
        total: number
      }) {
        const pct = total > 0 ? (completed / total) * 100 : 0
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-ctr-primary h-2 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 whitespace-nowrap">
              {completed}/{total}
            </span>
          </div>
        )
      },
    [],
  )

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="온보딩 현황"
        description="신규 입사자 온보딩 진행 현황을 확인합니다."
      />

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(limit)}
          onValueChange={(v) => {
            setLimit(Number(v))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}건
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Table ─── */}
      {loading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {['직원명', '입사일', '버디', '템플릿', '진행률', '상태', '지연', ''].map(
                  (h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={`sk-${i}-${j}`}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-md border p-8">
          <EmptyState
            title="온보딩 데이터가 없습니다"
            description="현재 조건에 해당하는 온보딩 기록이 없습니다."
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>직원명</TableHead>
                  <TableHead>입사일</TableHead>
                  <TableHead>버디</TableHead>
                  <TableHead>템플릿</TableHead>
                  <TableHead className="w-48">진행률</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>지연</TableHead>
                  {isHrAdmin && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow
                    key={row.id}
                    className={row.isDelayed ? 'bg-yellow-50' : ''}
                  >
                    <TableCell className="font-medium">
                      {row.employee.name}
                    </TableCell>
                    <TableCell>
                      {row.employee.hireDate
                        ? new Date(row.employee.hireDate).toLocaleDateString(
                            'ko-KR',
                          )
                        : '-'}
                    </TableCell>
                    <TableCell>{row.buddy?.name ?? '-'}</TableCell>
                    <TableCell>{row.template.name}</TableCell>
                    <TableCell>
                      <ProgressBar
                        completed={row.progress.completed}
                        total={row.progress.total}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANTS[row.status] ?? 'outline'}
                      >
                        {row.status === 'IN_PROGRESS' && (
                          <Clock className="mr-1 h-3 w-3" />
                        )}
                        {row.status === 'COMPLETED' && (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.isDelayed ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          지연
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-green-500 text-green-700"
                        >
                          정상
                        </Badge>
                      )}
                    </TableCell>
                    {isHrAdmin && (
                      <TableCell>
                        {row.status !== 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => setForceTarget(row)}
                          >
                            강제 완료
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* ─── Pagination ─── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-muted-foreground">
                전체 {pagination?.total.toLocaleString()}건
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  이전
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Force Complete Dialog ─── */}
      <Dialog
        open={!!forceTarget}
        onOpenChange={(open) => {
          if (!open) {
            setForceTarget(null)
            setForceReason('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>온보딩 강제 완료</DialogTitle>
            <DialogDescription>
              {forceTarget?.employee.name}님의 온보딩을 강제로 완료합니다.
              미완료 태스크는 SKIPPED 처리됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label
              htmlFor="force-reason"
              className="text-sm font-medium mb-2 block"
            >
              강제 완료 사유 *
            </label>
            <Textarea
              id="force-reason"
              placeholder="강제 완료 사유를 입력해주세요..."
              value={forceReason}
              onChange={(e) => setForceReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setForceTarget(null)
                setForceReason('')
              }}
            >
              취소
            </Button>
            <Button
              onClick={handleForceComplete}
              disabled={!forceReason.trim() || forceLoading}
              className="bg-ctr-accent hover:bg-ctr-accent/90 text-white"
            >
              {forceLoading ? '처리 중...' : '강제 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
