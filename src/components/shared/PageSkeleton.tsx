// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Page Skeleton Components
// Suspense fallback용 스켈레톤 (스태거링 애니메이션)
// ═══════════════════════════════════════════════════════════

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ─── KPI Cards Skeleton ─────────────────────────────────

interface KpiCardsSkeletonProps {
  count?: number
  className?: string
}

export function KpiCardsSkeleton({ count = 4, className }: KpiCardsSkeletonProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl shadow-sm bg-card p-4 space-y-3"
          style={{ animationDelay: `${i * 75}ms` }}
        >
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

// ─── Table Skeleton ─────────────────────────────────────

interface TableSkeletonProps {
  rows?: number
  cols?: number
  className?: string
}

export function TableSkeleton({ rows = 8, cols = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn('rounded-2xl shadow-sm bg-card overflow-hidden', className)}>
      {/* 헤더 */}
      <div className="flex gap-4 p-4 bg-muted/50">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* 행 — 스태거링 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 p-4"
          style={{ animationDelay: `${i * 75}ms` }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Chart Skeleton ─────────────────────────────────────

interface ChartSkeletonProps {
  className?: string
}

export function ChartSkeleton({ className }: ChartSkeletonProps) {
  return (
    <div className={cn('rounded-2xl shadow-sm bg-card p-6', className)}>
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className="h-64 w-full rounded" />
    </div>
  )
}

// ─── Page Composite Skeletons ───────────────────────────

/** 홈 대시보드 스켈레톤 (KPI 카드 + 차트) */
export function HomeSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <KpiCardsSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartSkeleton className="h-80" />
        <ChartSkeleton className="h-80" />
      </div>
    </div>
  )
}

/** 목록형 페이지 스켈레톤 (필터 + 테이블) */
export function ListPageSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      {/* 필터 바 */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <TableSkeleton />
    </div>
  )
}

/** 분석 대시보드 스켈레톤 (KPI + 차트 그리드) */
export function AnalyticsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-56" />
      <KpiCardsSkeleton count={5} className="grid-cols-2 md:grid-cols-5" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartSkeleton className="h-80" />
        <ChartSkeleton className="h-80" />
        <ChartSkeleton className="h-80" />
        <ChartSkeleton className="h-80" />
      </div>
    </div>
  )
}
