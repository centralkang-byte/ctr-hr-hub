'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Generic Widget Skeleton
// CLS(Cumulative Layout Shift) 방지용 로딩 스켈레톤
// Phase 3: Session 2
// ═══════════════════════════════════════════════════════════

interface WidgetSkeletonProps {
  /** 위젯 최소 높이 (Tailwind h-* 클래스) */
  height?: string
  /** 스켈레톤 내부에 표시할 라인 수 */
  lines?: number
  /** 차트 영역 표시 여부 */
  showChart?: boolean
}

export function WidgetSkeleton({
  height = 'h-48',
  lines = 3,
  showChart = false,
}: WidgetSkeletonProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-[#F0F0F3] p-6 ${height} animate-pulse`}
    >
      {/* Title bar */}
      <div className="h-4 bg-[#F0F0F3] rounded w-1/3 mb-5" />

      {showChart ? (
        /* Chart area placeholder */
        <div className="h-28 bg-[#F0F0F3] rounded-lg" />
      ) : (
        /* Text lines */
        <div className="space-y-2.5">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 bg-[#F0F0F3] rounded"
              style={{ width: `${100 - i * 15}%` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
