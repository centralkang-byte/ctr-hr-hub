'use client'
import { CARD_STYLES } from '@/lib/styles'

export function WidgetSkeleton({ height = 'h-48' }: { height?: string }) {
  return (
    <div className={`${CARD_STYLES.kpi} ${height} animate-pulse`}>
      <div className="h-4 bg-[#F5F5F5] rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-[#F5F5F5] rounded w-full" />
        <div className="h-3 bg-[#F5F5F5] rounded w-4/5" />
        <div className="h-3 bg-[#F5F5F5] rounded w-3/5" />
      </div>
    </div>
  )
}
