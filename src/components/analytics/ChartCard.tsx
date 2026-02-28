'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Chart Card
// 차트를 감싸는 카드 (제목 + 설명 + 차트 슬롯)
// ═══════════════════════════════════════════════════════════

import { type ReactNode } from 'react'

interface ChartCardProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function ChartCard({ title, description, children, className }: ChartCardProps) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ''}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
