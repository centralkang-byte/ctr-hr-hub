'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Plus, RotateCcw } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { StatusBadge } from '@/components/ui/StatusBadge'
import DashboardStatsBar from '@/components/performance/quarterly-review/DashboardStatsBar'
import BulkCreateDialog from '@/components/performance/quarterly-review/BulkCreateDialog'

// ─── Types ──────────────────────────────────────────────────

interface ReviewItem {
  id: string
  year: number
  quarter: string
  status: string
  overallSentiment: string | null
  employeeSubmittedAt: string | null
  managerSubmittedAt: string | null
  updatedAt: string
  employee: { id: string; name: string; employeeNo: string }
  manager: { id: string; name: string } | null
  _count: { goalProgress: number }
}

interface DashboardData {
  totalReviews: number
  completionRate: number
  statusDistribution: Record<string, number>
}

interface Props {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
const STATUSES = ['DRAFT', 'IN_PROGRESS', 'EMPLOYEE_DONE', 'MANAGER_DONE', 'COMPLETED'] as const

// ─── Component ──────────────────────────────────────────────

export default function QuarterlyReviewAdminClient({ user }: Props) {
  const t = useTranslations('performance.quarterlyReview')
  const tc = useTranslations('common')
  const router = useRouter()

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [bulkOpen, setBulkOpen] = useState(false)

  // Filters
  const [year, setYear] = useState<string>(String(CURRENT_YEAR))
  const [quarter, setQuarter] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string | number> = {
        year: parseInt(year),
        page,
        limit: 20,
      }
      if (quarter !== 'all') params.quarter = quarter
      if (status !== 'all') params.status = status

      const [reviewsRes, dashboardRes] = await Promise.all([
        apiClient.getList<ReviewItem>('/api/v1/performance/quarterly-reviews', params),
        apiClient.get<DashboardData>('/api/v1/performance/quarterly-reviews/dashboard', {
          year: parseInt(year),
          quarter: quarter !== 'all' ? quarter : undefined,
        }),
      ])

      setReviews(reviewsRes.data)
      setTotal(reviewsRes.pagination?.total ?? 0)
      setDashboard(dashboardRes.data)
    } catch (err) {
      toast({
        title: t('toast.loadFailed'),
        description: err instanceof Error ? err.message : tc('retry'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [year, quarter, status, page, t, tc])

  useEffect(() => { fetchData() }, [fetchData])

  const handleReopen = useCallback(async (reviewId: string) => {
    try {
      await apiClient.put(`/api/v1/performance/quarterly-reviews/${reviewId}/reopen`, {})
      toast({ title: t('toast.reopenSuccess') })
      fetchData()
    } catch (err) {
      toast({
        title: t('toast.submitFailed'),
        description: err instanceof Error ? err.message : tc('retry'),
        variant: 'destructive',
      })
    }
  }, [fetchData, t, tc])

  void user
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('adminTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
        <Button onClick={() => setBulkOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('action.bulkCreate')}
        </Button>
      </div>

      {/* Dashboard KPIs */}
      <DashboardStatsBar data={dashboard} />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={year} onValueChange={(v) => { setYear(v); setPage(1) }}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quarter} onValueChange={(v) => { setQuarter(v); setPage(1) }}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter.allQuarters')}</SelectItem>
            {QUARTERS.map((q) => (
              <SelectItem key={q} value={q}>{t(`quarter.${q}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter.allStatuses')}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t('empty.title')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('empty.description')}</p>
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.employee')}</TableHead>
                  <TableHead>{t('table.manager')}</TableHead>
                  <TableHead>{t('table.quarterCol')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead>{t('table.sentiment')}</TableHead>
                  <TableHead>{t('table.updatedAt')}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow
                    key={review.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/performance/quarterly-reviews/${review.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{review.employee.name}</p>
                        <p className="text-xs text-muted-foreground">{review.employee.employeeNo}</p>
                      </div>
                    </TableCell>
                    <TableCell>{review.manager?.name ?? '—'}</TableCell>
                    <TableCell>{t(`quarter.${review.quarter}`)}</TableCell>
                    <TableCell>
                      <StatusBadge status={review.status}>{t(`status.${review.status}`)}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      {review.overallSentiment
                        ? t(`sentiment.${review.overallSentiment}`)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums font-mono text-muted-foreground">
                      {new Date(review.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {review.status === 'COMPLETED' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('confirm.reopenTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>{t('confirm.reopenDesc')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleReopen(review.id)}>
                                {tc('confirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {tc('prev')}
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tc('next')}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Bulk Create Dialog */}
      <BulkCreateDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSuccess={fetchData}
      />
    </div>
  )
}
