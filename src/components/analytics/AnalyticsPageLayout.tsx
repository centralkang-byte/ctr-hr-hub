'use client'

// ═══════════════════════════════════════════════════════════
// CTR HR Hub — Analytics Page Layout
// 공통 레이아웃 (제목 + 설명 + 액션 버튼)
// CompanySelector는 Header에서 이미 제공
// ═══════════════════════════════════════════════════════════

import { type ReactNode } from 'react'

interface AnalyticsPageLayoutProps {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
}

export function AnalyticsPageLayout({
  title,
  description,
  children,
  actions,
}: AnalyticsPageLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>

      {/* Content */}
      {children}
    </div>
  )
}
