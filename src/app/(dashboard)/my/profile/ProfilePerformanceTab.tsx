'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — My Profile · Performance Summary Tab
// 본인 최근 (공개된) 평가 결과 요약.
// cycle 게이팅은 MyResultClient와 동일: getAllowedStatuses('result', half).
// 미공개(DRAFT 등) cycle의 매니저 평가가 새지 않도록 공개 cycle만 조회.
// 다주기 평가이력·MBO 이력·받은 칭찬은 후속.
// ═══════════════════════════════════════════════════════════

// ─── Imports ────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Award, Star, Target, ArrowRight } from 'lucide-react'
import { WdStatStrip } from '@/components/shared/WdStatStrip'
import { EmptyState } from '@/components/ui/EmptyState'
import { KpiCardsSkeleton } from '@/components/shared/PageSkeleton'
import { apiClient } from '@/lib/api'
import { AppError } from '@/lib/errors'
import { getAllowedStatuses } from '@/lib/performance/pipeline'

// ─── Types ──────────────────────────────────────────────────
interface CycleOption {
  id: string
  name: string
  status: string
  half: string | null
  isResultPublished: boolean
}

interface ReviewSummary {
  finalGrade: string | null
  finalGradeLabel: string | null
  totalScore: number | null
  mboScore: number | null
  cycleName: string
}

// ─── Component ──────────────────────────────────────────────
export function ProfilePerformanceTab() {
  const t = useTranslations('mySpace')
  const [review, setReview] = useState<ReviewSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)
      const cyclesRes = await apiClient.getList<CycleOption>('/api/v1/performance/cycles', { page: 1, limit: 100 })
      // 결과 열람 허용 = 결과 열람 단계(CLOSED 이후) AND 결과 공개(isResultPublished).
      // EMPLOYEE에게 COMP_REVIEW 등은 status=CLOSED·isResultPublished=false로 마스킹되므로
      // status만으로는 미공개 결과가 새어나갈 수 있음 (pipeline.ts 'result' 주석 참조).
      const allowed = (cyclesRes.data ?? []).filter(
        (c) => c.isResultPublished === true && getAllowedStatuses('result', c.half ?? 'H2').includes(c.status),
      )
      if (allowed.length === 0) {
        setReview(null)
        return
      }
      const cycle = allowed[0] // cycles는 year desc 정렬 → 최신
      // 해당 cycle 리뷰 없음 = 400(badRequest) → empty. 그 외(403/500 등)는 error로 전파(재시도 가능).
      let r: (ReviewSummary & { cycleName?: string }) | null = null
      try {
        const resultRes = await apiClient.get<{ review: ReviewSummary | null }>(
          '/api/v1/performance/reviews/my-result',
          { cycleId: cycle.id },
        )
        r = resultRes?.data?.review ?? null
      } catch (e) {
        if (e instanceof AppError && e.statusCode === 400) r = null
        else throw e
      }
      setReview(r ? { ...r, cycleName: r.cycleName ?? cycle.name } : null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <KpiCardsSkeleton count={3} />
  if (error) {
    return (
      <EmptyState
        icon={Award}
        title={t('profile.summary.loadError')}
        action={{ label: t('profile.summary.retry'), onClick: load }}
      />
    )
  }

  if (!review) {
    return <EmptyState icon={Award} title={t('profile.performanceTab.empty')} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{review.cycleName}</p>
        <Link href="/performance/my-result" className="flex items-center gap-1 text-sm text-primary hover:underline">
          {t('profile.summary.viewDetail')} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <WdStatStrip
        items={[
          {
            label: t('profile.performanceTab.latestGrade'),
            value: review.finalGradeLabel ?? review.finalGrade ?? '-',
            icon: Award,
            tone: 'success',
          },
          {
            label: t('profile.performanceTab.totalScore'),
            value: review.totalScore != null ? review.totalScore.toFixed(1) : '-',
            icon: Star,
            tone: 'info',
          },
          {
            label: t('profile.performanceTab.mboScore'),
            value: review.mboScore != null ? review.mboScore.toFixed(1) : '-',
            icon: Target,
            tone: 'default',
          },
        ]}
      />
    </div>
  )
}
