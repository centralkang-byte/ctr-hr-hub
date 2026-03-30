'use client'

interface WidgetEmptyProps {
  title: string
  message?: string
}

export function WidgetEmpty({ title, message = '데이터가 없습니다' }: WidgetEmptyProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6">
      <p className="text-xs text-[#666] mb-3">{title}</p>
      <div className="flex items-center justify-center h-32 text-sm text-[#999]">
        {message}
      </div>
    </div>
  )
}
