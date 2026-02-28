'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Empty Chart State
// ═══════════════════════════════════════════════════════════

import { BarChart3 } from 'lucide-react'

interface EmptyChartProps {
  message?: string
}

export function EmptyChart({ message = '데이터가 없습니다.' }: EmptyChartProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <BarChart3 className="mb-2 h-10 w-10" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
