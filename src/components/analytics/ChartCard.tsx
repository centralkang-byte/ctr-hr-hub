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
    <div className={`rounded-xl border border-[#E8E8E8] bg-white p-5 ${className ?? ''}`}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#1A1A1A]">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-[#666]">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
