'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import type { SessionUser } from '@/types'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ArrowRight } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'

// ─── Types ──────────────────────────────────────────────────

interface ReviewItem {
  id: string
  year: number
  quarter: string
  status: string
  goalHighlights: string | null
  challenges: string | null
  employeeSubmittedAt: string | null
  managerSubmittedAt: string | null
  updatedAt: string
  manager: { id: string; name: string } | null
  _count: { goalProgress: number }
}

interface Props {
  user: SessionUser
}

// ─── Constants ──────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const

// ─── Component ──────────────────────────────────────────────

export default function MyQuarterlyReviewClient({ user: _user }: Props) {
  const t = useTranslations('performance.quarterlyReview')
  const tc = useTranslations('common')
  const router = useRouter()

  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState<string>(String(CURRENT_YEAR))
  const [quarter, setQuarter] = useState<string>('all')

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, string | number> = {
        year: parseInt(year),
        limit: 50,
      }
      if (quarter !== 'all') params.quarter = quarter
      const res = await apiClient.getList<ReviewItem>(
        '/api/v1/performance/quarterly-reviews',
        params,
      )
      setReviews(res.data)
    } catch (err) {
      toast({
        title: t('toast.loadFailed'),
        description: err instanceof Error ? err.message : tc('retry'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [year, quarter, t, tc])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('myTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={quarter} onValueChange={setQuarter}>
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
      </div>

      {/* Review Cards */}
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
        <div className="grid gap-4">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="p-5 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => router.push(`/performance/quarterly-reviews/${review.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {review.year} {t(`quarter.${review.quarter}`)}
                    </span>
                    <StatusBadge status={review.status}>
                      {t(`status.${review.status}`)}
                    </StatusBadge>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                {review.manager && (
                  <span>{t('table.manager')}: {review.manager.name}</span>
                )}
                <span>{t('section.goalProgress')}: {review._count.goalProgress}</span>
                {review.employeeSubmittedAt && (
                  <span className="tabular-nums font-mono text-xs">
                    {t('table.submittedAt')}: {new Date(review.employeeSubmittedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {review.goalHighlights && (
                <p className="mt-2 text-sm line-clamp-2">{review.goalHighlights}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
