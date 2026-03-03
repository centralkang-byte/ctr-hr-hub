'use client'

export function WidgetSkeleton({ height = 'h-48' }: { height?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-[#E8E8E8] p-5 ${height} animate-pulse`}>
      <div className="h-4 bg-[#F5F5F5] rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-[#F5F5F5] rounded w-full" />
        <div className="h-3 bg-[#F5F5F5] rounded w-4/5" />
        <div className="h-3 bg-[#F5F5F5] rounded w-3/5" />
      </div>
    </div>
  )
}
